"""
pdf_generator.py
Generates official, formatted statutory PDF compliance returns using ReportLab (Item 4).
Supports:
- compliance_summary
- violations
- closure_performance
Styled with Royal Blue (#1E40AF) executive headers, clean tabular grids, and statutory certification seals.
"""

import io
from datetime import datetime
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def generate_compliance_pdf(
    report_id: str,
    report_type: str,
    scope_meta: Dict[str, Any],
    payload: Dict[str, Any],
    generated_at: datetime,
) -> bytes:
    """
    Renders a formatted PDF document from a report payload.
    Returns raw PDF bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    primary_color = colors.HexColor("#1E40AF")
    secondary_color = colors.HexColor("#0F172A")
    slate_500 = colors.HexColor("#64748B")
    border_color = colors.HexColor("#CBD5E1")
    surface_bg = colors.HexColor("#F8FAFC")

    title_style = ParagraphStyle(
        "GovTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=primary_color,
        alignment=0,
    )

    subtitle_style = ParagraphStyle(
        "GovSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=slate_500,
        alignment=0,
    )

    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=secondary_color,
        spaceAfter=6,
        spaceBefore=10,
    )

    cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=secondary_color,
    )

    cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=secondary_color,
    )

    header_cell = ParagraphStyle(
        "HeaderCell",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )

    elements: List[Any] = []

    # 1. Header Banner
    elements.append(Paragraph("MINISTRY OF COAL &bull; DGMS STATUTORY COMPLIANCE RETURN", title_style))
    elements.append(
        Paragraph(
            "Intellifusion SafeMine &mdash; AI-Based Smart Governance & Compliance Monitoring System (SIH26024)",
            subtitle_style,
        )
    )
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceBefore=0, spaceAfter=8))

    # 2. Metadata Block
    formatted_type = report_type.replace("_", " ").upper()
    meta_data = [
        [
            Paragraph("<b>REPORT TYPE:</b>", cell_style),
            Paragraph(formatted_type, cell_bold),
            Paragraph("<b>REPORT ID:</b>", cell_style),
            Paragraph(str(report_id)[:18] + "...", cell_style),
        ],
        [
            Paragraph("<b>GENERATED AT:</b>", cell_style),
            Paragraph(generated_at.strftime("%Y-%m-%d %H:%M:%S UTC"), cell_style),
            Paragraph("<b>SCOPE:</b>", cell_style),
            Paragraph(str(scope_meta.get("target_mines", "All Authorized Mines")), cell_style),
        ],
        [
            Paragraph("<b>DATE WINDOW:</b>", cell_style),
            Paragraph(
                f"{scope_meta.get('date_from') or 'Baseline'} to {scope_meta.get('date_to') or 'Present'}",
                cell_style,
            ),
            Paragraph("<b>ISSUING AUTHORITY:</b>", cell_style),
            Paragraph("Directorate General of Mines Safety (DGMS)", cell_style),
        ],
    ]

    meta_table = Table(meta_data, colWidths=[1.3 * inch, 2.3 * inch, 1.4 * inch, 2.4 * inch])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), surface_bg),
                ("BOX", (0, 0), (-1, -1), 0.5, border_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(meta_table)
    elements.append(Spacer(1, 12))

    # 3. Content Sections based on report_type
    if report_type == "compliance_summary":
        elements.append(Paragraph("1. EXECUTIVE STATUTORY SUMMARY", section_heading))

        total_obs = payload.get("total_observations", 0)
        compliance_pct = payload.get("compliance_rate_pct", 100.0)

        kpi_data = [
            [
                Paragraph("METRIC DESCRIPTION", header_cell),
                Paragraph("STATUTORY COUNT / SCORE", header_cell),
                Paragraph("REGULATORY THRESHOLD / BENCHMARK", header_cell),
            ],
            [
                Paragraph("Total Field Observations Logged", cell_style),
                Paragraph(str(total_obs), cell_bold),
                Paragraph("Continuous Digital Ledger Verification", cell_style),
            ],
            [
                Paragraph("Statutory Compliance Rate", cell_style),
                Paragraph(f"{compliance_pct}%", cell_bold),
                Paragraph("Mandatory Minimum DGMS Benchmark: 85.0%", cell_style),
            ],
        ]

        # Status breakdown
        by_status = payload.get("observations_by_status", {})
        for st_name, count in by_status.items():
            kpi_data.append(
                [
                    Paragraph(f"Status Breakdown &mdash; {st_name.upper()}", cell_style),
                    Paragraph(str(count), cell_style),
                    Paragraph("Point-in-time snapshot status", cell_style),
                ]
            )

        summary_table = Table(kpi_data, colWidths=[3.2 * inch, 2.0 * inch, 2.2 * inch])
        summary_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), primary_color),
                    ("GRID", (0, 0), (-1, -1), 0.5, border_color),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        elements.append(summary_table)
        elements.append(Spacer(1, 10))

        # Category Breakdown
        elements.append(Paragraph("2. OBSERVATIONS BY REGULATORY CATEGORY", section_heading))
        by_cat = payload.get("observations_by_category", {})
        cat_data = [
            [Paragraph("CATEGORY", header_cell), Paragraph("COUNT", header_cell), Paragraph("PERCENTAGE", header_cell)]
        ]
        for cat_name, cnt in by_cat.items():
            pct = f"{(cnt / total_obs * 100):.1f}%" if total_obs > 0 else "0.0%"
            cat_data.append([Paragraph(cat_name.upper(), cell_style), Paragraph(str(cnt), cell_bold), Paragraph(pct, cell_style)])

        cat_table = Table(cat_data, colWidths=[2.5 * inch, 2.5 * inch, 2.4 * inch])
        cat_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), primary_color),
                    ("GRID", (0, 0), (-1, -1), 0.5, border_color),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        elements.append(cat_table)

    elif report_type == "violations":
        elements.append(Paragraph("1. REGISTER OF STATUTORY VIOLATIONS & NOTICES", section_heading))
        records = payload.get("records", [])

        viol_data = [
            [
                Paragraph("REF ID", header_cell),
                Paragraph("CATEGORY", header_cell),
                Paragraph("DESCRIPTION & THRESHOLD BREACH", header_cell),
                Paragraph("RISK LEVEL", header_cell),
                Paragraph("STATUS", header_cell),
            ]
        ]

        if not records:
            viol_data.append(
                [Paragraph("No active statutory violations recorded for this scope.", cell_style), Paragraph("", cell_style), Paragraph("", cell_style), Paragraph("", cell_style), Paragraph("", cell_style)]
            )
        else:
            for r in records[:25]:  # Limit top 25 records to keep concise
                ref_id = str(r.get("id", ""))[:8]
                cat = str(r.get("category", "")).upper()
                desc = str(r.get("description", ""))
                risk = str(r.get("risk_flag", "")).upper()
                status_val = str(r.get("status", "")).upper()
                viol_data.append(
                    [
                        Paragraph(ref_id, cell_style),
                        Paragraph(cat, cell_style),
                        Paragraph(desc[:80] + ("..." if len(desc) > 80 else ""), cell_style),
                        Paragraph(risk, cell_bold),
                        Paragraph(status_val, cell_style),
                    ]
                )

        viol_table = Table(viol_data, colWidths=[1.0 * inch, 1.2 * inch, 3.2 * inch, 1.0 * inch, 1.0 * inch])
        viol_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), primary_color),
                    ("GRID", (0, 0), (-1, -1), 0.5, border_color),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        elements.append(viol_table)

    elif report_type == "closure_performance":
        elements.append(Paragraph("1. REMEDIATION & SLA CLOSURE PERFORMANCE", section_heading))
        perf_data = [
            [Paragraph("METRIC", header_cell), Paragraph("VALUE", header_cell)],
            [Paragraph("Total Corrective Actions Tracked", cell_style), Paragraph(str(payload.get("total_actions", 0)), cell_bold)],
            [Paragraph("Verified Closed Actions", cell_style), Paragraph(str(payload.get("closed_actions", 0)), cell_bold)],
            [Paragraph("Average Remediation Time (Hours)", cell_style), Paragraph(f"{payload.get('avg_closure_hours', 0.0):.1f}h", cell_bold)],
            [Paragraph("Actions Exceeding Statutory SLA (>72h)", cell_style), Paragraph(str(payload.get("overdue_actions", 0)), cell_bold)],
        ]

        perf_table = Table(perf_data, colWidths=[4.4 * inch, 3.0 * inch])
        perf_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), primary_color),
                    ("GRID", (0, 0), (-1, -1), 0.5, border_color),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        elements.append(perf_table)

    # 4. Statutory Certification & Digital Seal Footer
    elements.append(Spacer(1, 16))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceBefore=4, spaceAfter=8))

    cert_text = (
        "<b>OFFICIAL STATUTORY CERTIFICATION:</b> This document constitutes an authenticated "
        "statutory return generated under the governance framework of the Mines Act 1952, "
        "Coal Mines Regulations (CMR) 2017, and CPCB Environmental Protection Standards. "
        "Every event is anchored to the Intellifusion cryptographic audit trail with SHA-256 integrity verification."
    )
    elements.append(Paragraph(cert_text, subtitle_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
