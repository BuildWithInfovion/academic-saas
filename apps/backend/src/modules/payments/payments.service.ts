import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
}

@Injectable()
export class PaymentsService {
  constructor(private config: ConfigService, private prisma: PrismaService) {}

  private get keyId() { return this.config.get<string>('RAZORPAY_KEY_ID'); }
  private get keySecret() { return this.config.get<string>('RAZORPAY_KEY_SECRET'); }

  isConfigured(): boolean {
    return !!this.keyId && !!this.keySecret;
  }

  getConfig() {
    return { enabled: this.isConfigured(), keyId: this.keyId ?? null };
  }

  async createOrder(institutionId: string, studentId: string, amount: number, receipt: string) {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Online payment is not configured for this school.');
    }
    if (amount < 1) throw new BadRequestException('Amount must be at least ₹1');

    // Verify student belongs to this institution
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new BadRequestException('Student not found');

    // Create Razorpay order via REST API (avoids requiring the Razorpay SDK)
    const amountPaise = Math.round(amount * 100);
    const credentials = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: receipt.substring(0, 40),
        notes: { institutionId, studentId },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new BadRequestException(`Failed to create payment order: ${err}`);
    }

    const order = await response.json() as RazorpayOrderResponse;
    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: this.keyId,
      receipt: order.receipt,
    };
  }

  verifySignature(razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string): boolean {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = crypto
      .createHmac('sha256', this.keySecret!)
      .update(body)
      .digest('hex');
    return expected === razorpaySignature;
  }

  // Called after successful Razorpay payment to record collection in our system
  async recordOnlinePayment(params: {
    institutionId: string;
    studentId: string;
    academicYearId?: string;
    items: { feePlanInstallmentId: string; feePlanItemId: string; feeCategoryId: string; amount: number }[];
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    collectedByUserId?: string;
  }) {
    if (!this.verifySignature(params.razorpayOrderId, params.razorpayPaymentId, params.razorpaySignature)) {
      throw new BadRequestException('Payment signature verification failed. Please contact the school.');
    }

    const currentYear = await this.prisma.academicYear.findFirst({
      where: { institutionId: params.institutionId, isCurrent: true },
      select: { id: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const baseCount = await tx.feeCollection.count({ where: { institutionId: params.institutionId } });
      const rcpYear = new Date().getFullYear();
      const collections: { receiptNo: string; amount: number; categoryName: string; installmentLabel?: string }[] = [];

      for (let i = 0; i < params.items.length; i++) {
        const item = params.items[i];
        const receiptNo = `FRC-${rcpYear}-${String(baseCount + i + 1).padStart(5, '0')}`;

        const installment = await tx.feePlanInstallment.findUnique({
          where: { id: item.feePlanInstallmentId },
          select: { label: true },
        });
        const category = await tx.feeCategory.findUnique({
          where: { id: item.feeCategoryId },
          select: { name: true },
        });

        await tx.feeCollection.create({
          data: {
            institutionId: params.institutionId,
            studentId: params.studentId,
            feePlanItemId: item.feePlanItemId,
            feePlanInstallmentId: item.feePlanInstallmentId,
            feeCategoryId: item.feeCategoryId,
            academicYearId: params.academicYearId ?? currentYear?.id,
            amount: item.amount,
            paymentMode: 'online',
            receiptNo,
            paidOn: new Date(),
            remarks: `Razorpay: ${params.razorpayPaymentId}`,
            collectedByUserId: params.collectedByUserId,
          },
        });

        collections.push({
          receiptNo,
          amount: item.amount,
          categoryName: category?.name ?? 'Fee',
          installmentLabel: installment?.label,
        });
      }

      return {
        collections,
        totalCollected: params.items.reduce((s, i) => s + i.amount, 0),
        paymentId: params.razorpayPaymentId,
      };
    }, { timeout: 15000 });
  }
}
