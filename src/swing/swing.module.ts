import { Module, HttpModule } from '@nestjs/common';

import { SwingController } from './swing.controller';
import { SwingService } from './swing.service';
import { AppService } from '../app.service';
import { KiteService } from '../kite.service';
import { ApiCallService } from '../api-call.service';
import { ZerodhaService } from '../zerodha.service';
import { StockFeaturesService } from '../stock-features.service';


@Module({
  imports: [HttpModule],
  controllers: [SwingController],
  providers: [SwingService,AppService,KiteService,ApiCallService,ZerodhaService,StockFeaturesService],
})
export class SwingModule { }
