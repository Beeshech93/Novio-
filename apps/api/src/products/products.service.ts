import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseCsv, toCsv } from '../common/csv';
import { PrismaService } from '../prisma/prisma.service';
import { ListProductsQuery, ProductDto, UpdateProductDto } from './products.dto';

const CSV_COLUMNS = ['name', 'description', 'price', 'compareAtPrice', 'cost', 'sku', 'barcode', 'category', 'stock', 'minStock', 'taxRate', 'status'];

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // Every query below is scoped by businessId — the tenant-isolation rule.

  async list(businessId: string, q: ListProductsQuery) {
    const where: Prisma.ProductWhereInput = {
      businessId,
      deletedAt: null,
      ...(q.categoryId && { categoryId: q.categoryId }),
      ...(q.status && { status: q.status }),
      ...(q.q && {
        OR: [
          { name: { contains: q.q, mode: 'insensitive' } },
          { sku: { contains: q.q, mode: 'insensitive' } },
          { barcode: { contains: q.q } },
        ],
      }),
    };
    const page = q.page ?? 1, pageSize = q.pageSize ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where, include: { inventory: true, category: true },
        orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(businessId: string, id: string) {
    const p = await this.prisma.product.findFirst({
      where: { id, businessId, deletedAt: null }, include: { inventory: true, category: true },
    });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  async create(businessId: string, dto: ProductDto) {
    await this.assertCategory(businessId, dto.categoryId);
    const { stock, minStock, ...data } = dto;
    try {
      return await this.prisma.product.create({
        data: { ...data, businessId, inventory: { create: { businessId, stock: stock ?? 0, minStock: minStock ?? 0 } } },
        include: { inventory: true },
      });
    } catch (e) {
      throw this.mapUnique(e);
    }
  }

  async update(businessId: string, id: string, dto: UpdateProductDto) {
    await this.get(businessId, id);
    await this.assertCategory(businessId, dto.categoryId);
    const { stock, minStock, ...data } = dto;
    try {
      return await this.prisma.product.update({
        where: { id },
        data: {
          ...data,
          ...((stock !== undefined || minStock !== undefined) && {
            inventory: {
              upsert: {
                create: { businessId, stock: stock ?? 0, minStock: minStock ?? 0 },
                update: { ...(stock !== undefined && { stock }), ...(minStock !== undefined && { minStock }) },
              },
            },
          }),
        },
        include: { inventory: true },
      });
    } catch (e) {
      throw this.mapUnique(e);
    }
  }

  async remove(businessId: string, id: string) {
    await this.get(businessId, id);
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date(), sku: null } });
  }

  async duplicate(businessId: string, id: string) {
    const p = await this.get(businessId, id);
    return this.prisma.product.create({
      data: {
        businessId, categoryId: p.categoryId, name: `${p.name} (copia)`, description: p.description,
        price: p.price, compareAtPrice: p.compareAtPrice, cost: p.cost, imageUrl: p.imageUrl, taxRate: p.taxRate,
        status: 'INACTIVE', // SKU/barcode are not copied: SKU must stay unique per business
        inventory: { create: { businessId, stock: 0, minStock: p.inventory?.minStock ?? 0 } },
      },
      include: { inventory: true },
    });
  }

  async lowStock(businessId: string) {
    const rows = await this.prisma.inventory.findMany({ where: { businessId, product: { deletedAt: null } }, include: { product: true } });
    return rows.filter((r) => r.stock <= r.minStock);
  }

  async exportCsv(businessId: string) {
    const products = await this.prisma.product.findMany({
      where: { businessId, deletedAt: null }, include: { inventory: true, category: true }, orderBy: { name: 'asc' },
    });
    return toCsv(CSV_COLUMNS, products.map((p) => ({
      ...p, category: p.category?.name, stock: p.inventory?.stock ?? 0, minStock: p.inventory?.minStock ?? 0,
    })));
  }

  /** Imports rows one by one; invalid rows are reported instead of aborting the whole file. */
  async importCsv(businessId: string, csv: string) {
    const rows = parseCsv(csv);
    if (rows.length > 2000) throw new BadRequestException('Máximo 2000 filas por importación');
    const result = { created: 0, errors: [] as { row: number; message: string }[] };
    for (const [i, r] of rows.entries()) {
      const price = Number(r.price);
      if (!r.name || !Number.isFinite(price) || price < 0) {
        result.errors.push({ row: i + 2, message: 'Nombre o precio inválido' });
        continue;
      }
      try {
        let categoryId: string | undefined;
        if (r.category) {
          const cat = await this.prisma.productCategory.upsert({
            where: { businessId_name: { businessId, name: r.category } }, update: { deletedAt: null }, create: { businessId, name: r.category },
          });
          categoryId = cat.id;
        }
        await this.create(businessId, {
          name: r.name, description: r.description || undefined, price,
          compareAtPrice: r.compareAtPrice ? Number(r.compareAtPrice) : undefined,
          cost: r.cost ? Number(r.cost) : undefined,
          sku: r.sku || undefined, barcode: r.barcode || undefined, categoryId,
          stock: r.stock ? Math.max(0, parseInt(r.stock, 10) || 0) : 0,
          minStock: r.minStock ? Math.max(0, parseInt(r.minStock, 10) || 0) : 0,
          taxRate: r.taxRate ? Number(r.taxRate) : undefined,
          status: r.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        });
        result.created++;
      } catch (e) {
        result.errors.push({ row: i + 2, message: (e as Error).message });
      }
    }
    return result;
  }

  // ---- categories ----
  categories(businessId: string) {
    return this.prisma.productCategory.findMany({ where: { businessId, deletedAt: null }, orderBy: { name: 'asc' } });
  }
  async createCategory(businessId: string, name: string) {
    try {
      return await this.prisma.productCategory.create({ data: { businessId, name } });
    } catch (e) {
      throw this.mapUnique(e, 'Ya existe una categoría con ese nombre');
    }
  }
  async removeCategory(businessId: string, id: string) {
    const res = await this.prisma.productCategory.updateMany({ where: { id, businessId }, data: { deletedAt: new Date() } });
    if (!res.count) throw new NotFoundException('Categoría no encontrada');
  }

  /** A categoryId from the request must belong to the same business (prevents cross-tenant references). */
  private async assertCategory(businessId: string, categoryId?: string) {
    if (!categoryId) return;
    const c = await this.prisma.productCategory.findFirst({ where: { id: categoryId, businessId, deletedAt: null } });
    if (!c) throw new BadRequestException('Categoría inválida');
  }

  private mapUnique(e: unknown, msg = 'Ya existe un producto con ese SKU') {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return new ConflictException(msg);
    return e;
  }
}
