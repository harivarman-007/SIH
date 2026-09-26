/**
 * declarations.d.ts
 * Type declarations for mobile React Native, Expo, and navigation libraries.
 * Ensures clean compilation and IDE analysis when node_modules is not locally installed.
 */

declare module "react" {
  export = React;
}

declare namespace React {
  export type ReactNode = any;
  export type ReactElement = any;
  export type FC<P = {}> = (props: P & { children?: ReactNode; key?: any }) => any;
  export interface Component<P = {}, S = {}> {}
  export function createElement(...args: any[]): any;
  export function useState<T>(initialState: T | (() => T)): [T, (val: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export interface Context<T> {
    Provider: any;
    Consumer: any;
  }
  export function useContext<T>(context: Context<T>): T;
  export function useContext<T = any>(context: any): T;
  export function createContext<T>(defaultValue: T): Context<T>;
}

declare module "react-native" {
  export const View: any;
  export const Text: any;
  export const TextInput: any;
  export const TouchableOpacity: any;
  export const StyleSheet: {
    create: <T extends Record<string, any>>(styles: T) => T;
  };
  export const ScrollView: any;
  export const FlatList: any;
  export const Alert: {
    alert: (title: string, message?: string, buttons?: any[], options?: any) => void;
  };
  export const ActivityIndicator: any;
  export const Switch: any;
  export const Image: any;
  export const Modal: any;
  export const Platform: {
    OS: "ios" | "android" | "windows" | "macos" | "web";
    select: (obj: any) => any;
  };
  export const KeyboardAvoidingView: any;
  export const RefreshControl: any;
  export const StatusBar: any;
  export type ViewStyle = any;
  export type TextStyle = any;
  export type ImageStyle = any;
}

declare module "expo-status-bar" {
  export const StatusBar: any;
}

declare module "@expo/vector-icons" {
  export const Ionicons: {
    (props: any): any;
    glyphMap: Record<string, number>;
  };
  export const MaterialIcons: any;
  export const FontAwesome: any;
}

declare module "@react-navigation/native" {
  export const NavigationContainer: any;
  export function useNavigation<T = any>(): T;
  export function useRoute<T = any>(): T;
  export function useFocusEffect(effect: () => void | (() => void)): void;
  export type RouteProp<T, K extends keyof T> = {
    params: T[K];
    key: string;
    name: K;
  };
}

declare module "@react-navigation/native-stack" {
  export function createNativeStackNavigator<T = any>(): {
    Navigator: any;
    Screen: any;
  };
  export type NativeStackNavigationProp<T = any, K extends keyof T = any> = any;
}

declare module "expo-image-picker" {
  export function requestCameraPermissionsAsync(): Promise<{ status: string }>;
  export function launchCameraAsync(options?: any): Promise<{ canceled: boolean; assets?: any[] }>;
  export function launchImageLibraryAsync(options?: any): Promise<{ canceled: boolean; assets?: any[] }>;
  export const MediaTypeOptions: {
    Images: string;
    Videos: string;
    All: string;
  };
}

declare module "expo-location" {
  export function requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  export function getCurrentPositionAsync(options?: any): Promise<{ coords: { latitude: number; longitude: number; altitude?: number } }>;
  export const Accuracy: {
    High: number;
    Balanced: number;
    Low: number;
  };
}

declare module "expo-secure-store" {
  export function getItemAsync(key: string): Promise<string | null>;
  export function setItemAsync(key: string, value: string): Promise<void>;
  export function deleteItemAsync(key: string): Promise<void>;
}

declare module "expo-sqlite" {
  export interface SQLiteDatabase {
    execAsync(sql: string): Promise<any>;
    runAsync(sql: string, ...args: any[]): Promise<any>;
    getFirstAsync<T = any>(sql: string, ...args: any[]): Promise<T | null>;
    getAllAsync<T = any>(sql: string, ...args: any[]): Promise<T[]>;
    withTransactionAsync<T = any>(task: () => Promise<T>): Promise<T>;
    [key: string]: any;
  }
  export function openDatabaseSync(dbName: string): SQLiteDatabase;
  export function openDatabaseAsync(dbName: string): Promise<SQLiteDatabase>;
}

declare module "expo-task-manager" {
  export function defineTask(taskName: string, taskExecutor: any): void;
  export function isTaskRegisteredAsync(taskName: string): Promise<boolean>;
}

declare module "expo-background-fetch" {
  export function registerTaskAsync(taskName: string, options?: any): Promise<void>;
  export function unregisterTaskAsync(taskName: string): Promise<void>;
  export const BackgroundFetchResult: {
    NewData: number;
    NoData: number;
    Failed: number;
  };
}

declare module "expo-network" {
  export function getNetworkStateAsync(): Promise<{ isConnected?: boolean; isInternetReachable?: boolean }>;
}

declare module "expo-constants" {
  const Constants: {
    expoConfig?: any;
    manifest?: any;
    manifest2?: any;
    [key: string]: any;
  };
  export default Constants;
}

declare module "axios" {
  export interface AxiosInstance {
    defaults: any;
    interceptors: any;
    get<T = any>(url: string, config?: any): Promise<{ data: T; status: number; [key: string]: any }>;
    post<T = any>(url: string, data?: any, config?: any): Promise<{ data: T; status: number; [key: string]: any }>;
    put<T = any>(url: string, data?: any, config?: any): Promise<{ data: T; status: number; [key: string]: any }>;
    patch<T = any>(url: string, data?: any, config?: any): Promise<{ data: T; status: number; [key: string]: any }>;
    delete<T = any>(url: string, config?: any): Promise<{ data: T; status: number; [key: string]: any }>;
    [key: string]: any;
  }
  const axios: {
    create: (config?: any) => AxiosInstance;
    [key: string]: any;
  };
  export default axios;
}

declare module "zustand" {
  export type StateCreator<T> = (
    set: (partial: Partial<T> | ((state: T) => Partial<T>)) => void,
    get?: () => T,
    api?: any
  ) => T;
  export function create<T>(initializer: StateCreator<T>): {
    (): T;
    <U>(selector: (state: T) => U, equals?: (a: U, b: U) => boolean): U;
    getState: () => T;
    setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  };
}

declare module "*.json" {
  const value: any;
  export default value;
}
