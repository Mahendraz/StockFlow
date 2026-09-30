// Small helpers shared by the services: id parsing, pagination, and safe search input.

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

/** ?page and ?pageSize from the query string: page ≥ 1 (default 1), pageSize 1–100 (default 20). */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Shape of every paginated list response. */
export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Wraps one page of rows with the paging numbers the UI needs. totalPages is at least 1. */
export function toPage<T>(data: T[], total: number, { page, pageSize }: Pagination): Page<T> {
  return { data, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Escapes user input before it is used inside a RegExp (search boxes). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
