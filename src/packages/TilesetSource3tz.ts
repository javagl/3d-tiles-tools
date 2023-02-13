import fs from "fs";

import { defined } from "../base/defined";

import { TilesetSource } from "../tilesetData/TilesetSource";
import { TilesetError } from "../tilesetData/TilesetError";

import { IndexEntry } from "./IndexEntry";
import { ArchiveFunctions3tz } from "./ArchiveFunctions3tz";

/**
 * Implementation of a TilesetSource based on a 3TZ file.
 */
export class TilesetSource3tz implements TilesetSource {
  /**
   * The file descriptor that was created from the input file
   */
  private fd: number | undefined;

  /**
   * The ZIP index.
   *
   * This is created from the `"@3dtilesIndex1@"` file of a 3TZ file.
   *
   * It is an array if `IndexEntry` objects, sorted by the MD5 hash,
   * in ascending order.
   */
  private zipIndex: IndexEntry[] | undefined;

  /**
   * Default constructor
   */
  constructor() {
    this.fd = undefined;
    this.zipIndex = undefined;
  }

  getZipIndex(): IndexEntry[] | undefined {
    return this.zipIndex;
  }

  open(fullInputName: string) {
    if (defined(this.fd)) {
      throw new TilesetError("Source already opened");
    }

    this.fd = fs.openSync(fullInputName, "r");
    this.zipIndex = ArchiveFunctions3tz.readZipIndex(this.fd);
  }

  getKeys(): IterableIterator<string> {
    if (!defined(this.fd)) {
      throw new TilesetError("Source is not opened. Call 'open' first.");
    }
    let index = 0;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;
    return {
      [Symbol.iterator]() {
        return this;
      },
      next(): IteratorResult<string, any> {
        if (index >= that.zipIndex!.length) {
          return { value: undefined, done: true };
        }
        const entry = that.zipIndex![index];
        const offset = entry.offset;
        const fileName = ArchiveFunctions3tz.readFileName(that.fd!, offset);
        const result = {
          value: fileName,
          done: false,
        };
        index++;
        return result;
      },
    };
  }

  getValue(key: string) {
    if (!defined(this.fd)) {
      throw new TilesetError("Source is not opened. Call 'open' first.");
    }
    const entryData = ArchiveFunctions3tz.readEntryData(
      this.fd!,
      this.zipIndex!,
      key
    );
    return entryData;
  }

  close() {
    if (!defined(this.fd)) {
      throw new TilesetError("Source is not opened. Call 'open' first.");
    }
    fs.closeSync(this.fd!);

    this.fd = undefined;
    this.zipIndex = undefined;
  }
}