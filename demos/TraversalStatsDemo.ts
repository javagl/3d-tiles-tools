import fs from "fs";
import path from "path";

import { readJsonUnchecked } from "./readJsonUnchecked";

import { ResourceResolvers } from "../src/io/ResourceResolvers";

import { TilesetTraverser } from "../src/traversal/TilesetTraverser";
import { TraversedTile } from "../src/traversal/TraversedTile";

// A small demo that traverses a tileset, passes all
// traversed tiles to a "StatsCollector" (defined below),
// and creates a short JSON summary of some statistics.

async function tilesetTraversalDemo(filePath: string) {
  // Read the tileset from the input path
  const directory = path.dirname(filePath);
  const resourceResolver =
    ResourceResolvers.createFileResourceResolver(directory);
  const tileset = await readJsonUnchecked(filePath);
  // Note: External schemas are not considered here
  const schema = tileset.schema;

  // Traverse the tileset, and pass each tile to
  // the StatsCollector
  console.log("Traversing tileset");
  const statsCollector = new StatsCollector();
  const depthFirst = false;
  await TilesetTraverser.traverse(
    tileset,
    schema,
    resourceResolver,
    async (traversedTile) => {
      statsCollector.accept(traversedTile);
      return true;
    },
    depthFirst
  );
  console.log("Traversing tileset DONE");

  // Print the statistics summary to the console
  console.log("Stats:");
  const json = statsCollector.createJson();
  const jsonString = JSON.stringify(json, null, 2);
  console.log(jsonString);
}

// A simple class to collect statistical information about a tileset,
// from the tiles that are traversed with a TilesetTraverser
class StatsCollector {
  private totalNumberOfTiles = 0;
  private totalNumberOfSubtrees = 0;

  // A mapping from value names to statistical summaries
  private readonly summaries: {
    [key: string]: Summary;
  } = {};

  // Accept the given tile during traversal, and collect
  // statistical information
  accept(traversedTile: TraversedTile) {
    this.totalNumberOfTiles++;

    // NOTE: This is a means of checking whether a tile
    // is the root of an implicit tileset. This may be
    // refactored at some point.
    if (traversedTile.getImplicitTiling()) {
      this.totalNumberOfSubtrees++;
    } else {
      // Obtain all content URIs, resolve them, and obtain
      // the sizes of the corresponding files, storing them
      // in the "tileFileSize" summary
      const contentUris = traversedTile.getFinalContents().map((c) => c.uri);
      for (const contentUri of contentUris) {
        const resolvedContentUri = traversedTile.resolveUri(contentUri);
        const stats = fs.statSync(resolvedContentUri);
        const tileFileSizeInBytes = stats.size;
        this.acceptEntry("tileFileSize", tileFileSizeInBytes);
      }
    }

    // Store the geometric error in the "geometricError" summary
    const finalTile = traversedTile.asFinalTile();
    const geometricError = finalTile.geometricError;
    this.acceptEntry("geometricError", geometricError);
  }

  // Add one entry to a summary, creating it when necessary
  private acceptEntry(name: string, value: number) {
    let summary = this.summaries[name];
    if (!summary) {
      summary = new Summary();
      this.summaries[name] = summary;
    }
    summary.accept(value);
  }

  // Create a short JSON representation of the collected data
  createJson(): any {
    const json: any = {};
    json.totalNumberOfTiles = this.totalNumberOfTiles;
    json.totalNumberOfSubtrees = this.totalNumberOfSubtrees;
    for (const key of Object.keys(this.summaries)) {
      const summary = this.summaries[key];
      json[key] = {
        count: summary.getCount(),
        sum: summary.getSum(),
        min: summary.getMinimum(),
        max: summary.getMaximum(),
        avg: summary.getMean(),
        stdDev: summary.getStandardDeviation(),
      };
    }
    return json;
  }
}

/**
 * A class that can accept numbers, and collects statistical
 * information for these numbers.
 */
class Summary {
  private count: number;
  private sum: number;
  private min: number;
  private max: number;
  private varianceTracker: number;

  public constructor() {
    this.count = 0;
    this.sum = 0.0;
    this.min = Number.POSITIVE_INFINITY;
    this.max = Number.NEGATIVE_INFINITY;
    this.varianceTracker = 0.0;
  }

  accept(value: number) {
    const deviation = value - this.getMean();
    this.sum += value;
    this.min = Math.min(this.min, value);
    this.max = Math.max(this.max, value);
    this.count++;
    if (this.count > 1) {
      this.varianceTracker +=
        (deviation * deviation * (this.count - 1)) / this.count;
    }
  }

  getCount() {
    return this.count;
  }

  getSum() {
    return this.sum;
  }

  getMinimum() {
    return this.min;
  }

  getMaximum() {
    return this.max;
  }

  getMean() {
    return this.sum / this.count;
  }

  getStandardDeviation() {
    return Math.sqrt(this.varianceTracker / this.count);
  }
}

async function runDemo() {
  const tilesetFileName =
    "../3d-tiles-samples/1.1/SparseImplicitQuadtree/tileset.json";
  await tilesetTraversalDemo(tilesetFileName);
}

runDemo();