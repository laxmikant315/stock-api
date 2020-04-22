import { Module, HttpModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiCallService } from './api-call.service';
import { KiteService } from './kite.service';
import { StockFeaturesService } from './stock-features.service';
import { ZerodhaService } from './zerodha.service';
import { SwingModule } from './swing/swing.module';


@Module({
  imports: [HttpModule,SwingModule],
  controllers: [AppController],
  providers: [AppService, ApiCallService, KiteService, ZerodhaService, StockFeaturesService],
})
export class AppModule { }
