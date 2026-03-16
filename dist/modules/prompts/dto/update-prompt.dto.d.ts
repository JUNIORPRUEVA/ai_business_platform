import { PromptType } from '../entities/prompt.entity';
export declare class UpdatePromptDto {
    name?: string;
    type?: PromptType;
    content?: string;
    active?: boolean;
}
