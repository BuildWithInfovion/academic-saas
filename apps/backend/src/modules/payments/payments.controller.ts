import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // GET /payments/config — public info (is Razorpay enabled? what key?)
  @Get('config')
  @UseGuards(AuthGuard, TenantGuard)
  getConfig() {
    return this.paymentsService.getConfig();
  }

  // POST /payments/razorpay/order — create a payment order
  @Post('razorpay/order')
  @UseGuards(AuthGuard, TenantGuard)
  createOrder(
    @Req() req: any,
    @Body() body: {
      studentId: string;
      amount: number;
      receipt?: string;
    },
  ) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.paymentsService.createOrder(
      institutionId,
      body.studentId,
      body.amount,
      body.receipt ?? `${body.studentId.slice(-8)}-${Date.now()}`,
    );
  }

  // POST /payments/razorpay/verify — verify + record the payment
  @Post('razorpay/verify')
  @UseGuards(AuthGuard, TenantGuard)
  verifyAndRecord(
    @Req() req: any,
    @Body() body: {
      studentId: string;
      academicYearId?: string;
      items: { feePlanInstallmentId: string; feePlanItemId: string; feeCategoryId: string; amount: number }[];
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.paymentsService.recordOnlinePayment({
      institutionId,
      studentId: body.studentId,
      academicYearId: body.academicYearId,
      items: body.items,
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
      collectedByUserId: req.user?.userId,
    });
  }
}
