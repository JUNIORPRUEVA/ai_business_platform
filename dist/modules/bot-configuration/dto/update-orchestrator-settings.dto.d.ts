export declare class UpdateOrchestratorSettingsDto {
    automaticMode?: boolean;
    assistedMode?: boolean;
    enableRoleDetection?: boolean;
    enableIntentClassification?: boolean;
    enableToolExecution?: boolean;
    requireConfirmationForCriticalActions?: boolean;
    autonomyLevel?: 'strict' | 'guarded' | 'balanced';
    fallbackStrategy?: string;
}
