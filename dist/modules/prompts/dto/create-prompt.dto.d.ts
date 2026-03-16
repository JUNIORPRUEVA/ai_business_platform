import { PromptType } from '../entities/prompt.entity';
export declare class CreatePromptDto {
    name: string;
    type: PromptType;
    content: string;
    active?: boolean;
}
