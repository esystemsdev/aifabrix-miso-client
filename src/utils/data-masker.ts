/**
 * Data masker utility for client-side sensitive data protection.
 * Implements ISO 27001 data protection controls; policy from sensitive-fields JSON
 * (optional per-call `configPath` on `maskSensitiveData`).
 */

import * as fs from "fs";
import * as path from "path";
import {
  buildMergedSensitiveTokens,
  loadSensitiveFieldsConfigDict,
  neverMaskFieldsFromCfg,
  normalizeFieldName,
  substringMinLengthFromCfg,
} from "./sensitive-fields.loader";

export type MaskSensitiveDataOptions = {
  /** Per-call config file; does not change global DataMasker cache. */
  configPath?: string;
};

export class DataMasker {
  private static readonly MASKED_VALUE = "***MASKED***";

  private static configLoaded = false;
  private static sensitiveFields: Set<string> = new Set();
  private static neverMaskFields: Set<string> = new Set();
  private static substringMinLength = 4;
  private static explicitConfigPath: string | undefined;

  private static keyIsSensitive(
    key: string,
    sensitiveFields: Set<string>,
    neverMask: Set<string>,
    substrMin: number,
  ): boolean {
    const nk = normalizeFieldName(key);
    if (neverMask.has(nk)) {
      return false;
    }
    if (sensitiveFields.has(nk)) {
      return true;
    }
    for (const sf of sensitiveFields) {
      if (sf.length >= substrMin && nk.includes(sf)) {
        return true;
      }
    }
    return false;
  }

  private static loadGlobalConfig(): void {
    if (this.configLoaded) {
      return;
    }

    const cfg = loadSensitiveFieldsConfigDict(this.explicitConfigPath);
    this.sensitiveFields = buildMergedSensitiveTokens(cfg);
    this.neverMaskFields = neverMaskFieldsFromCfg(cfg);
    this.substringMinLength = substringMinLengthFromCfg(cfg);
    this.configLoaded = true;
  }

  /**
   * Set custom path for sensitive fields configuration (global cache).
   * Call before first use, or pass `undefined` to use env / packaged default resolution.
   */
  static setConfigPath(customPath?: string): void {
    this.configLoaded = false;
    this.explicitConfigPath = customPath;
    this.sensitiveFields = new Set();
    this.neverMaskFields = new Set();
    this.substringMinLength = 4;
    this.loadGlobalConfig();
  }

  private static getGlobalSensitiveFields(): Set<string> {
    this.loadGlobalConfig();
    return this.sensitiveFields;
  }

  /** Check if a field name indicates sensitive data (global config). */
  static isSensitiveField(key: string): boolean {
    this.loadGlobalConfig();
    return this.keyIsSensitive(
      key,
      this.sensitiveFields,
      this.neverMaskFields,
      this.substringMinLength,
    );
  }

  private static resolveOptionalConfigPath(configPath: string): string | null {
    const resolved = path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      return null;
    }
    return resolved;
  }

  private static maskRecursive(
    data: unknown,
    isSensitive: (k: string) => boolean,
  ): unknown {
    if (data === null || data === undefined) {
      return data;
    }
    if (typeof data !== "object") {
      return data;
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.maskRecursive(item, isSensitive));
    }
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (isSensitive(key)) {
        masked[key] = this.MASKED_VALUE;
      } else if (typeof value === "object" && value !== null) {
        masked[key] = this.maskRecursive(value, isSensitive);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  /**
   * Mask sensitive data in objects, arrays, or primitives.
   * Returns a masked copy without modifying the original.
   */
  static maskSensitiveData(
    data: unknown,
    options?: MaskSensitiveDataOptions,
  ): unknown {
    if (options?.configPath) {
      const resolved = this.resolveOptionalConfigPath(options.configPath);
      if (!resolved) {
        return this.maskSensitiveData(data);
      }
      const cfg = loadSensitiveFieldsConfigDict(resolved);
      const sens = buildMergedSensitiveTokens(cfg);
      const never = neverMaskFieldsFromCfg(cfg);
      const substrMin = substringMinLengthFromCfg(cfg);
      const isSens = (k: string) =>
        this.keyIsSensitive(k, sens, never, substrMin);
      return this.maskRecursive(data, isSens);
    }

    this.loadGlobalConfig();
    const isSens = (k: string) =>
      this.keyIsSensitive(
        k,
        this.sensitiveFields,
        this.neverMaskFields,
        this.substringMinLength,
      );
    return this.maskRecursive(data, isSens);
  }

  /**
   * Mask specific value (useful for masking individual strings).
   */
  static maskValue(
    value: string,
    showFirst: number = 0,
    showLast: number = 0,
  ): string {
    if (!value || value.length <= showFirst + showLast) {
      return this.MASKED_VALUE;
    }

    const first = showFirst > 0 ? value.substring(0, showFirst) : "";
    const last = showLast > 0 ? value.substring(value.length - showLast) : "";
    const maskedLength = Math.max(8, value.length - showFirst - showLast);
    const masked = "*".repeat(maskedLength);

    return `${first}${masked}${last}`;
  }

  /** Check if data contains sensitive information (global config). */
  static containsSensitiveData(data: unknown): boolean {
    if (data === null || data === undefined || typeof data !== "object") {
      return false;
    }

    if (Array.isArray(data)) {
      return data.some((item) => this.containsSensitiveData(item));
    }

    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (this.isSensitiveField(key)) {
        return true;
      }
      if (typeof value === "object" && value !== null) {
        if (this.containsSensitiveData(value)) {
          return true;
        }
      }
    }

    return false;
  }
}
