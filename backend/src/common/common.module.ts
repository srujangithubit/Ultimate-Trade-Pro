import { Module, Global } from '@nestjs/common';
import { ModelInferenceService } from './model-inference.service';

@Global()
@Module({
  providers: [ModelInferenceService],
  exports: [ModelInferenceService],
})
export class CommonModule {}
