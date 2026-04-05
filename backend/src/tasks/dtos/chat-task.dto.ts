import { IsString } from 'class-validator';

export class ChatTaskDto {
  @IsString()
  message: string;
}
