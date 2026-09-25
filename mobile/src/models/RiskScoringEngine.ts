/**
 * RiskScoringEngine.ts
 * On-device offline inference engine for React Native / Expo.
 * Evaluates the rule layer and traversals across Isolation Forest decision trees in pure TypeScript.
 */

export interface ObservationInput {
  category: "safety" | "environment" | "labour" | "production";
  description: string;
  created_at?: string;
  zone_risk_baseline?: number;
  inspector_historical_high_rate?: number;
  days_since_last_zone_inspection?: number;
  has_photo?: boolean;
}

export interface RiskScoringResult {
  score: number;
  flag: "low" | "medium" | "high";
  reasons: {
    top_contributors: string[];
    rule_override?: string;
    rationale?: string;
    features?: Record<string, number>;
  };
  rule_triggered: boolean;
}

interface TreeNode {
  id: number;
  feature: number;
  threshold: number | null;
  left: number;
  right: number;
  is_leaf: boolean;
  samples: number;
}

interface Tree {
  node_count: number;
  nodes: TreeNode[];
}

interface ModelWeights {
  model_type: string;
  version: string;
  feature_names: string[];
  c_factor: number;
  thresholds: {
    high: number;
    medium: number;
  };
  trees: Tree[];
}

const CRITICAL_RULES: [string, RegExp, string][] = [
  [
    "ROOF_STRATA_COLLAPSE",
    /\b(roof\s*fall|strata\s*failure|bench\s*collapse|side\s*fall|slope\s*failure|landslide|cave\s*in)\b/i,
    "Imminent strata failure or collapse detected in working gallery/bench",
  ],
  [
    "EXPLOSION_OR_FIRE",
    /\b(explosion|fire|spontaneous\s*combustion|smoke\s*detected|blast\s*misfire|detonator\s*damage)\b/i,
    "Fire or explosive hazard detected requiring emergency evacuation protocol",
  ],
  [
    "HAZARDOUS_GAS_LEAK",
    /\b(methane|ch4|carbon\s*monoxide|co\s*level|toxic\s*gas|noxious\s*gas|oxygen\s*depletion|gas\s*leak)\b/i,
    "Dangerous accumulation or leak of hazardous/toxic mine gas",
  ],
  [
    "WATER_INUNDATION",
    /\b(inundation|flooding|water\s*breakthrough|sump\s*overflow|drowning\s*hazard)\b/i,
    "Underground water breakthrough or inundation hazard",
  ],
  [
    "FATAL_OR_HAUL_FAILURE",
    /\b(fatal|critical\s*injury|conveyor\s*snap|haul\s*truck\s*brake|runaway\s*vehicle|electrocution)\b/i,
    "Critical mechanical or high-voltage hazard with life-safety impact",
  ],
];

export function checkCriticalRules(description: string): {
  matched: boolean;
  ruleId?: string;
  rationale?: string;
  matchText?: string;
} {
  const desc = description || "";
  for (const [ruleId, regex, rationale] of CRITICAL_RULES) {
    const match = desc.match(regex);
    if (match) {
      return {
        matched: true,
        ruleId,
        rationale: `${rationale} (trigger: '${match[0]}')`,
        matchText: match[0],
      };
    }
  }
  return { matched: false };
}

const SAFETY_KEYWORDS = [
  "crack", "spall", "fall", "leak", "methane", "gas", "fire", "smoke",
  "blasting", "explosive", "failure", "collapse", "inundation", "flyrock",
  "subsidence", "hazard", "unsupported", "defective", "damage", "strata",
];

const ENV_KEYWORDS = [
  "spill", "turbidity", "discharge", "exceedance", "slurry", "overflow",
  "acid", "leachate", "contamination", "seepage", "dust plume", "effluent",
];

const LABOUR_KEYWORDS = [
  "missing", "violation", "unauthorized", "unregistered", "fatigue",
  "overtime", "non-compliance", "without ppe", "penalty", "expired",
];

function cFactor(n: number): number {
  if (n <= 1) return 1.0;
  if (n === 2) return 1.0;
  const euler = 0.57721566490153286;
  return 2.0 * (Math.log(n - 1.0) + euler) - (2.0 * (n - 1.0)) / n;
}

export class RiskScoringEngine {
  private model: ModelWeights;

  constructor(modelData: ModelWeights) {
    this.model = modelData;
  }

  public extractFeatures(obs: ObservationInput): { vector: number[]; dict: Record<string, number> } {
    const cat = obs.category || "safety";
    const desc = (obs.description || "").toLowerCase();

    const catSafety = cat === "safety" ? 1.0 : 0.0;
    const catEnv = cat === "environment" ? 1.0 : 0.0;
    const catLabour = cat === "labour" ? 1.0 : 0.0;

    const dt = obs.created_at ? new Date(obs.created_at) : new Date();
    const hourNorm = dt.getHours() / 23.0;
    const dowNorm = dt.getDay() / 6.0;

    const zoneBaseline = Math.max(0, Math.min(1, obs.zone_risk_baseline ?? 0.4));

    const kwSafety = SAFETY_KEYWORDS.some((kw) => desc.includes(kw)) ? 1.0 : 0.0;
    const kwEnv = ENV_KEYWORDS.some((kw) => desc.includes(kw)) ? 1.0 : 0.0;
    const kwLabour = LABOUR_KEYWORDS.some((kw) => desc.includes(kw)) ? 1.0 : 0.0;

    const inspRate = Math.max(0, Math.min(1, obs.inspector_historical_high_rate ?? 0.25));
    const daysSince = Math.min(30, obs.days_since_last_zone_inspection ?? 7) / 30.0;
    const hasPhoto = obs.has_photo ? 1.0 : 0.0;

    const dict: Record<string, number> = {
      category_safety: catSafety,
      category_environment: catEnv,
      category_labour: catLabour,
      hour_of_day_norm: Number(hourNorm.toFixed(4)),
      day_of_week_norm: Number(dowNorm.toFixed(4)),
      zone_risk_baseline: Number(zoneBaseline.toFixed(4)),
      keyword_safety_flag: kwSafety,
      keyword_env_flag: kwEnv,
      keyword_labour_flag: kwLabour,
      inspector_historical_high_rate: Number(inspRate.toFixed(4)),
      days_since_last_inspection_norm: Number(daysSince.toFixed(4)),
      has_photo: hasPhoto,
    };

    const vector = this.model.feature_names.map((name) => dict[name] ?? 0.0);
    return { vector, dict };
  }

  private traverseTree(tree: Tree, x: number[]): number {
    let currId = 0;
    let depth = 0;

    while (true) {
      const node = tree.nodes[currId];
      if (node.is_leaf) {
        if (node.samples > 1) {
          return depth + cFactor(node.samples);
        }
        return depth;
      }

      const fIdx = node.feature;
      const thresh = node.threshold!;
      if (x[fIdx] <= thresh) {
        currId = node.left;
      } else {
        currId = node.right;
      }
      depth += 1;
    }
  }

  private computeAnomalyScore(x: number[]): number {
    let totalPath = 0;
    for (const tree of this.model.trees) {
      totalPath += this.traverseTree(tree, x);
    }
    const meanPath = totalPath / this.model.trees.length;
    const score = Math.pow(2.0, -(meanPath / this.model.c_factor));
    return Math.min(1.0, Math.max(0.0, score));
  }

  public scoreObservation(obs: ObservationInput): RiskScoringResult {
    const desc = obs.description || "";

    // 1. Critical rule layer
    for (const [ruleId, regex, rationale] of CRITICAL_RULES) {
      const match = desc.match(regex);
      if (match) {
        const { dict } = this.extractFeatures(obs);
        return {
          score: 0.95,
          flag: "high",
          reasons: {
            rule_override: ruleId,
            rationale: `${rationale} (trigger: '${match[0]}')`,
            top_contributors: ["critical_hazard_trigger", "zone_risk_baseline"],
            features: dict,
          },
          rule_triggered: true,
        };
      }
    }

    // 2. Isolation Forest anomaly scoring
    const { vector, dict } = this.extractFeatures(obs);
    const rawScore = this.computeAnomalyScore(vector);

    // Calibrated Isolation Forest component (maps [0.42, 0.68] to [0.0, 1.0])
    const ifComponent = Math.min(1.0, Math.max(0.0, (rawScore - 0.42) / (0.68 - 0.42)));

    // Domain risk factor
    const maxKeyword = Math.max(
      dict.keyword_safety_flag ?? 0,
      dict.keyword_env_flag ?? 0,
      dict.keyword_labour_flag ?? 0
    );

    const domainFactor =
      0.40 * (dict.zone_risk_baseline ?? 0.3) +
      0.35 * maxKeyword +
      0.15 * (dict.inspector_historical_high_rate ?? 0.2) +
      0.10 * (dict.days_since_last_inspection_norm ?? 0.2);

    const calibrated = 0.45 * ifComponent + 0.55 * domainFactor;
    const score = Number(Math.min(1.0, Math.max(0.05, calibrated)).toFixed(3));

    let flag: "low" | "medium" | "high" = "low";
    if (score >= 0.60) {
      flag = "high";
    } else if (score >= 0.35) {
      flag = "medium";
    }

    // Identify top positive features
    const topContributors = Object.entries(dict)
      .filter(([_, v]) => v > 0.5)
      .map(([k]) => k)
      .slice(0, 3);

    return {
      score,
      flag,
      reasons: {
        top_contributors: topContributors.length > 0 ? topContributors : ["zone_risk_baseline"],
        features: dict,
      },
      rule_triggered: false,
    };
  }
}
