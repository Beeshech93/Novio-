import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationsService } from '../automations/automations.service';
import { PrismaService } from '../prisma/prisma.service';
import * as D from './appointments.dto';
import { computeSlots, Interval, overlaps, weekdayOf, zonedToUtc } from './time';

const ACTIVE: AppointmentStatus[] = ['pending', 'confirmed'];
const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [], cancelled: [], no_show: [],
};
export const canMove = (from: AppointmentStatus, to: AppointmentStatus) => TRANSITIONS[from].includes(to);

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService, private notifications?: NotificationsService, private automations?: AutomationsService) {}

  // ---------- services ----------
  listServices(businessId: string) { return this.prisma.service.findMany({ where: { businessId, deletedAt: null }, orderBy: { name: 'asc' } }); }
  createService(businessId: string, dto: D.ServiceDto) { return this.prisma.service.create({ data: { ...dto, businessId } }); }
  async updateService(businessId: string, id: string, dto: D.UpdateServiceDto) {
    const r = await this.prisma.service.updateMany({ where: { id, businessId, deletedAt: null }, data: dto });
    if (!r.count) throw new NotFoundException('Servicio no encontrado');
    return this.prisma.service.findFirstOrThrow({ where: { id, businessId } });
  }
  async removeService(businessId: string, id: string) {
    const r = await this.prisma.service.updateMany({ where: { id, businessId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!r.count) throw new NotFoundException('Servicio no encontrado');
  }

  // ---------- employees ----------
  listEmployees(businessId: string) { return this.prisma.employee.findMany({ where: { businessId, deletedAt: null }, orderBy: { name: 'asc' } }); }
  createEmployee(businessId: string, dto: D.EmployeeDto) { return this.prisma.employee.create({ data: { ...dto, businessId } }); }
  async removeEmployee(businessId: string, id: string) {
    const r = await this.prisma.employee.updateMany({ where: { id, businessId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!r.count) throw new NotFoundException('Empleado no encontrado');
  }

  // ---------- hours & blocked days ----------
  getHours(businessId: string) { return this.prisma.businessHours.findMany({ where: { businessId }, orderBy: { weekday: 'asc' } }); }
  async setHours(businessId: string, days: D.DayHoursDto[]) {
    for (const d of days) if (d.closeMin <= d.openMin) throw new BadRequestException('La hora de cierre debe ser posterior a la de apertura');
    if (new Set(days.map((d) => d.weekday)).size !== days.length) throw new BadRequestException('Día repetido');
    await this.prisma.$transaction([
      this.prisma.businessHours.deleteMany({ where: { businessId } }),
      this.prisma.businessHours.createMany({ data: days.map((d) => ({ ...d, businessId })) }),
    ]);
    return this.getHours(businessId);
  }
  listBlocked(businessId: string) { return this.prisma.blockedDate.findMany({ where: { businessId }, orderBy: { date: 'asc' } }); }
  async block(businessId: string, dto: D.BlockDateDto) {
    await this.assertEmployee(businessId, dto.employeeId);
    return this.prisma.blockedDate.create({ data: { businessId, employeeId: dto.employeeId, date: new Date(`${dto.date}T00:00:00Z`), reason: dto.reason } });
  }
  async unblock(businessId: string, id: string) {
    const r = await this.prisma.blockedDate.deleteMany({ where: { id, businessId } });
    if (!r.count) throw new NotFoundException();
  }

  // ---------- availability ----------
  async availability(businessId: string, q: D.AvailabilityQuery) {
    const [business, service] = await Promise.all([
      this.prisma.business.findFirstOrThrow({ where: { id: businessId } }),
      this.prisma.service.findFirst({ where: { id: q.serviceId, businessId, deletedAt: null, status: 'ACTIVE' } }),
    ]);
    if (!service) throw new NotFoundException('Servicio no encontrado');
    await this.assertEmployee(businessId, q.employeeId);
    return this.slotsFor(business.id, business.timezone, service.durationMin, q.date, q.employeeId ?? null);
  }

  private async slotsFor(businessId: string, tz: string, durationMin: number, date: string, employeeId: string | null, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const dayStart = zonedToUtc(date, 0, tz), dayEnd = zonedToUtc(date, 1440, tz);
    const [hours, blocked, busy] = await Promise.all([
      db.businessHours.findUnique({ where: { businessId_weekday: { businessId, weekday: weekdayOf(date) } } }),
      db.blockedDate.findFirst({ where: { businessId, date: new Date(`${date}T00:00:00Z`), OR: [{ employeeId: null }, ...(employeeId ? [{ employeeId }] : [])] } }),
      db.appointment.findMany({ where: { businessId, employeeId, status: { in: ACTIVE }, startAt: { lt: dayEnd }, endAt: { gt: dayStart } }, select: { startAt: true, endAt: true } }),
    ]);
    const slots = computeSlots({
      date, tz, hours: hours ? { openMin: hours.openMin, closeMin: hours.closeMin } : null, durationMin,
      busy: busy.map((b): Interval => ({ start: b.startAt, end: b.endAt })), blocked: !!blocked,
    });
    return { date, timezone: tz, slots };
  }

  // ---------- appointments ----------
  list(businessId: string, q: D.ListAppointmentsQuery) {
    return this.prisma.appointment.findMany({
      where: {
        businessId,
        ...(q.employeeId && { employeeId: q.employeeId }), ...(q.status && { status: q.status }),
        ...((q.from || q.to) && { startAt: { ...(q.from && { gte: new Date(`${q.from}T00:00:00Z`) }), ...(q.to && { lt: new Date(`${q.to}T23:59:59Z`) }) } }),
      },
      include: { customer: true, employee: true, service: true }, orderBy: { startAt: 'asc' }, take: 500,
    });
  }

  async create(businessId: string, dto: D.CreateAppointmentDto, source = 'internal') {
    await this.assertEmployee(businessId, dto.employeeId);
    if (dto.customerId) {
      const c = await this.prisma.customer.findFirst({ where: { id: dto.customerId, businessId, deletedAt: null } });
      if (!c) throw new BadRequestException('Cliente inválido');
    }
    return this.book(businessId, { serviceId: dto.serviceId, employeeId: dto.employeeId ?? null, customerId: dto.customerId ?? null, startAt: new Date(dto.startAt), notes: dto.notes, source, requireOpenSlot: true });
  }

  async reschedule(businessId: string, id: string, dto: D.RescheduleDto) {
    const a = await this.prisma.appointment.findFirst({ where: { id, businessId } });
    if (!a) throw new NotFoundException('Cita no encontrada');
    if (!ACTIVE.includes(a.status)) throw new BadRequestException('Solo se pueden mover citas pendientes o confirmadas');
    await this.assertEmployee(businessId, dto.employeeId);
    const duration = a.endAt.getTime() - a.startAt.getTime();
    return this.withSerializable(async (tx) => {
      const employeeId = dto.employeeId ?? a.employeeId;
      const start = new Date(dto.startAt), end = new Date(start.getTime() + duration);
      await this.assertFree(tx, businessId, employeeId, { start, end }, id);
      return tx.appointment.update({ where: { id }, data: { startAt: start, endAt: end, employeeId } });
    });
  }

  async setStatus(businessId: string, id: string, to: AppointmentStatus) {
    const a = await this.prisma.appointment.findFirst({ where: { id, businessId } });
    if (!a) throw new NotFoundException('Cita no encontrada');
    if (!canMove(a.status, to)) throw new BadRequestException(`No se puede pasar de ${a.status} a ${to}`);
    const r = await this.prisma.appointment.updateMany({ where: { id, businessId, status: a.status }, data: { status: to } });
    if (!r.count) throw new ConflictException('La cita cambió, intenta de nuevo');
    return this.prisma.appointment.findFirstOrThrow({ where: { id, businessId } });
  }

  // ---------- public booking (visitor of a published site) ----------
  async publicBusiness(host: string) {
    const site = await this.prisma.website.findFirst({
      where: { published: true, business: { deletedAt: null, status: 'ACTIVE' }, OR: [{ subdomain: host.toLowerCase() }, { customDomain: host.toLowerCase() }] },
      include: { business: true },
    });
    if (!site) throw new NotFoundException();
    return site.business;
  }
  async publicAvailability(host: string, q: D.AvailabilityQuery) {
    const b = await this.publicBusiness(host);
    return this.availability(b.id, { ...q, employeeId: undefined });
  }
  async publicBook(host: string, dto: D.PublicBookingDto) {
    const b = await this.publicBusiness(host);
    const phone = dto.phone.replace(/[^\d+]/g, '');
    let customer = await this.prisma.customer.findFirst({ where: { businessId: b.id, phone, deletedAt: null } });
    if (!customer) customer = await this.prisma.customer.create({ data: { businessId: b.id, name: dto.name, phone, whatsapp: phone, email: dto.email } });
    const a = await this.book(b.id, { serviceId: dto.serviceId, employeeId: null, customerId: customer.id, startAt: new Date(dto.startAt), source: 'website', requireOpenSlot: true });
    return { id: a.id, startAt: a.startAt, endAt: a.endAt, status: a.status };
  }

  // ---------- internals ----------
  private async book(businessId: string, i: { serviceId: string; employeeId: string | null; customerId: string | null; startAt: Date; notes?: string; source: string; requireOpenSlot: boolean }) {
    const service = await this.prisma.service.findFirst({ where: { id: i.serviceId, businessId, deletedAt: null, status: 'ACTIVE' } });
    if (!service) throw new BadRequestException('Servicio inválido');
    const business = await this.prisma.business.findFirstOrThrow({ where: { id: businessId } });
    const end = new Date(i.startAt.getTime() + service.durationMin * 60000);

    const appt = await this.withSerializable(async (tx) => {
      // The requested start must be one of the computed open slots for that day (hours, blocked days, notice, overlaps).
      const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: business.timezone }).format(i.startAt);
      const { slots } = await this.slotsFor(businessId, business.timezone, service.durationMin, localDate, i.employeeId, tx);
      if (!slots.includes(i.startAt.toISOString())) throw new ConflictException('Ese horario ya no está disponible');
      return tx.appointment.create({
        data: { businessId, customerId: i.customerId, employeeId: i.employeeId, serviceId: i.serviceId, startAt: i.startAt, endAt: end, notes: i.notes, source: i.source },
      });
    });
    void this.automations?.fire(businessId, 'appointment.created', `appointment:${appt.id}`, { customerId: appt.customerId, appointment: { service: service.name } });
    void this.notifyBooked(business, service.name, appt).catch(() => undefined); // fire-and-forget: never fails the booking
    return appt;
  }

  private async notifyBooked(business: { id: string; name: string; timezone: string }, serviceName: string, appt: { customerId: string | null; startAt: Date }) {
    const n = this.notifications;
    if (!n) return;
    const customer = appt.customerId ? await this.prisma.customer.findFirst({ where: { id: appt.customerId, businessId: business.id } }) : null;
    await n.internal(business.id, 'appointment.created', 'Nueva cita', `${customer?.name ?? 'Cliente'} · ${serviceName}`);
    const p = { business: business.name, service: serviceName, startAt: appt.startAt, tz: business.timezone };
    await n.sendWhatsApp(business.id, customer?.whatsapp ?? customer?.phone, 'appointment_confirmation', p);
    await n.sendEmail(business.id, customer?.email, 'appointment_created', p);
  }

  private async assertFree(tx: Prisma.TransactionClient, businessId: string, employeeId: string | null, iv: Interval, ignoreId?: string) {
    const clash = await tx.appointment.findMany({
      where: { businessId, employeeId, status: { in: ACTIVE }, id: { not: ignoreId }, startAt: { lt: iv.end }, endAt: { gt: iv.start } }, select: { startAt: true, endAt: true },
    });
    if (clash.some((c) => overlaps(iv, { start: c.startAt, end: c.endAt }))) throw new ConflictException('Ese horario ya no está disponible');
  }

  /** Serializable isolation makes two concurrent bookings of the same slot fail instead of double-booking. */
  private async withSerializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') throw new ConflictException('Ese horario acaba de ser reservado');
      throw e;
    }
  }

  private async assertEmployee(businessId: string, employeeId?: string | null) {
    if (!employeeId) return;
    const e = await this.prisma.employee.findFirst({ where: { id: employeeId, businessId, deletedAt: null } });
    if (!e) throw new BadRequestException('Empleado inválido');
  }
}
