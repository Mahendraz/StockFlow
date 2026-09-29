import { Types } from "mongoose";
import { z } from "zod";
import { notFound } from "./errors";

/**
 * Parses a route id. A malformed id is answered with 404 rather than 400:
 * from the caller's point of view the resource simply does not exist.
 */
export function parseObjectId(id: string, resource: string): Types.ObjectId {
  if (!/^[a-f\d]{24}$/i.test(id)) throw notFound(resource);
  return new Types.ObjectId(id);
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function toPage<T>(data: T[], total: number, { page, pageSize }: Pagination): Page<T> {
  return { data, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Escapes user input before it is used inside a RegExp (search boxes). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
