/**
 * TOON (Token Oriented Object Notation)
 * JSON <-> TOON convertible format.
 *
 * Rules:
 *  - Objects:  key1: value1, key2: value2
 *  - Arrays:   keyName[count]:  item1 | item2 | item3
 *  - Items that contain commas or pipes are safely escaped using JSON.stringify()
 */

const TOON = (() => {

  // Escape any string that contains comma, pipe, or colon
  function esc(value) {
    if (typeof value === "string" && (value.includes(",") || value.includes("|") || value.includes(":"))) {
      return JSON.stringify(value);   // produces "string,with,comma"
    }
    return value;
  }

  // Always JSON.stringify objects or arrays inside table rows
  function escRowValue(v) {
    if (v === null || typeof v !== "object") return esc(v);
    return JSON.stringify(v);
  }

  // ---------------------------------------------------------
  //  JSON → TOON
  // ---------------------------------------------------------
  function jsonToToon(value, indent = "") {
    if (value === null) return "null";
    if (typeof value !== "object") return esc(value);

    if (Array.isArray(value)) {
      // Array of scalars?
      const scalars = value.every(v => v === null || typeof v !== "object");
      if (scalars) {
        return value.map(v => esc(v)).join(",");
      }
      // Array of objects → tabular form?
      const sameKeys =
        value.length > 0 &&
        value.every(v => typeof v === "object" && !Array.isArray(v));

      if (sameKeys) {
        const keys = Array.from(new Set(value.flatMap(obj => Object.keys(obj))));
        let out = `${keys.join(",")}:\n`;
        for (const row of value) {
          const rowVals = keys.map(k => escRowValue(row[k]));
          out += `${indent}  ${rowVals.join(",")}\n`;
        }
        return out.trimEnd();
      }

      // Mixed content fallback
      return value.map(v => jsonToToon(v, indent + "  ")).join(", ");
    }

    // Object
    let out = "";
    for (const [k, v] of Object.entries(value)) {
      if (Array.isArray(v)) {
        // Detect array of objects
        const objects =
          v.length > 0 &&
          v.every(x => x && typeof x === "object" && !Array.isArray(x));

        if (objects) {
          const keys = Array.from(new Set(v.flatMap(obj => Object.keys(obj))));
          out += `${indent}${k}[${v.length}]{${keys.join(",")}}:\n`;
          for (const row of v) {
            const rowVals = keys.map(kk => escRowValue(row[kk]));
            out += `${indent}  ${rowVals.join(",")}\n`;
          }
        } else {
          // Array of scalars
          const list = v.map(x => esc(x)).join(",");
          out += `${indent}${k}[${v.length}]: ${list}\n`;
        }
      } else if (typeof v === "object" && v !== null) {
        out += `${indent}${k}:\n${jsonToToon(v, indent + "  ")}\n`;
      } else {
        out += `${indent}${k}: ${esc(v)}\n`;
      }
    }
    return out.trimEnd();
  }


  // ---------------------------------------------------------
  //  TOON → JSON
  // ---------------------------------------------------------

  // Reverse escape (try JSON.parse if quoted)
  function unesc(v) {
    if (v === undefined) return undefined;
    if (typeof v === "string" && v.trim() === "") return undefined;

    // Try to parse as JSON if it looks like an array or object
    if (typeof v === "string" && (/^\[.*\]$/.test(v.trim()) || /^\{.*\}$/.test(v.trim()))) {
      try { return JSON.parse(v); } catch {}
    }
    if (typeof v === "string" && /^".*"$/.test(v.trim())) {
      try { return JSON.parse(v); } catch {}
    }
    if (v === "null") return null;           // actual null
    if (v === "true") return true;
    if (v === "false") return false;
    if (!isNaN(Number(v))) return Number(v);
    return v; // plain string
  }

  // Parse CSV line respecting JSON-escaped strings
  function parseCsv(line) {
    const tokens = [];
    let cur = "";
    let inQuotes = false;
    let bracketDepth = 0;
    let braceDepth = 0;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        cur += ch;
        if (i === 0 || line[i - 1] !== "\\") {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes) {
        if (ch === '[') bracketDepth++;
        if (ch === ']') bracketDepth--;
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
        if (ch === ',' && bracketDepth === 0 && braceDepth === 0) {
          tokens.push(cur.trim());
          cur = "";
          continue;
        }
      }
      cur += ch;
    }
    tokens.push(cur.trim());
    return tokens;
  }

  function toonToJson(toon) {
    const lines = toon.split(/\r?\n/);
    let i = 0;

    function parseBlock(indent = "") {
      const obj = {};

      while (i < lines.length) {
        let line = lines[i];
        if (!line.trim()) { i++; continue; }

        const currentIndent = line.match(/^\s*/)[0];
        if (currentIndent.length < indent.length) break;

        line = line.trim();
        i++;

        // Root-level array of objects (fields: without key prefix)
        // Format: "field1,field2,field3:" followed by indented rows
        // Must have comma-separated fields (multiple fields) to distinguish from object property
        let m = line.match(/^([^:\[]+):\s*$/);
        if (m && indent === "" && m[1].includes(",") && i < lines.length && lines[i].match(/^\s+/)) {
          const fieldStr = m[1];
          const fields = fieldStr.split(",").map(s => s.trim());
          const arr = [];
          
          while (i < lines.length) {
            const fullLine = lines[i];
            if (!fullLine.trim()) { i++; continue; }
            if (!fullLine.match(/^\s+/)) break;
            
            i++;
            const rowParts = parseCsv(fullLine.trim());
            const rowObj = {};
            
            fields.forEach((f, idx) => {
              const v = unesc(rowParts[idx]);
              if (v !== undefined) rowObj[f] = v;
            });
            
            arr.push(rowObj);
          }
          
          return arr;
        }

        // key[N]{fields}:
        m = line.match(/^(\w+)\[(\d+)\]\{([^}]*)\}:\s*$/);
        if (m) {
          const [, key, countStr, fieldStr] = m;
          const count = Number(countStr);
          const fields = fieldStr.split(",").map(s => s.trim());
          const arr = [];

          for (let r = 0; r < count; r++) {
            const rowLine = lines[i++]?.trim();
            if (!rowLine) continue;

            const rowParts = parseCsv(rowLine);
            const rowObj = {};

            fields.forEach((f, idx) => {
              const v = unesc(rowParts[idx]);
              if (v !== undefined) rowObj[f] = v;
            });

            arr.push(rowObj);
          }

          obj[key] = arr;
          continue;
        }

        // key[N]:
        m = line.match(/^(\w+)\[(\d+)\]:\s*(.*)$/);
        if (m) {
          const [, key, , rest] = m;
          const parts = parseCsv(rest);
          obj[key] = parts.map(unesc).filter(v => v !== undefined);
          continue;
        }

        // key:
        m = line.match(/^(\w+):\s*$/);
        if (m) {
          const [, key] = m;
          const block = parseBlock(currentIndent + "  ");
          obj[key] = block;
          continue;
        }

        // key: value
        m = line.match(/^(\w+):\s*(.*)$/);
        if (m) {
          const [, key, rawVal] = m;
          const v = unesc(rawVal);
          if (v !== undefined) obj[key] = v;
          continue;
        }
      }
      return obj;
    }

    return parseBlock("");
  }

  // Public API
  return { jsonToToon, toonToJson };

})();


// CommonJS export if available
if (typeof module !== "undefined" && module.exports) {
  module.exports = TOON;
}



const json = {
  "context": {
    "task": "Our favorite hikes together",
    "location": "Boulder",
    "season": "spring_2025"
  },
  "friends": ["ana", "luis", "sam"],
  "hikes": [
    {
      "id": 1,
      "name": "Blue Lake Trail",
      "distanceKm": 7.5,
      "elevationGain": 320,
      "companion": "ana",
      "wasSunny": true
    },
    {
      "id": 2,
      "name": "Ridge Overlook",
      "distanceKm": 9.2,
      "elevationGain": 540,
      "companion": "luis",
      "wasSunny": false
    },
    {
      "id": 3,
      "name": "Wildflower Loop",
      "distanceKm": 5.1,
      "elevationGain": 180,
      "companion": "sam",
      "wasSunny": true
    }
  ],
  id: 101,
  name: "SampleItem",
  items: [
    { type: "alpha", values: [1, 2, 3, null,undefined,,,1,null] },
    { type: "beta", values: [4, 5, 6], name:'myname' },
    { type: "gamma", values: [7, 8, 9], lastName:'sur,name' }
  ]
};


const toon = TOON.jsonToToon(json);
console.log("TOON: \n" + toon);

const back = TOON.toonToJson(toon);
console.log("JSON AGAIN: \n" + JSON.stringify(back, null, 2));

const toonm = TOON.jsonToToon(back);
console.log("TOON m: \n" + toonm);

console.log(toon == toonm );



const json2 = [{A: 1, B: 'B: text'}];

const json3 = {
  "project": "Example",
  "items": [
    {
      "id": 1,
      "name": "Alpha",
      "tags": ["a", "b", "c"],
      "details": [
        { 
          "key": "color", 
          "value": "red",
          "values": ["red", "green", "blue"]
        },
        { 
          "key": "size", 
          "value": "large",
          "values": ["small", "medium", "large"]
        }
      ]
    },
    {
      "id": 2,
      "name": "Beta",
      "tags": [],
      "details": [
        { 
          "key": "active", 
          "value": true,
          "values": [true, false]
        }
      ]
    }
  ]
};

const toon2 = TOON.jsonToToon(json3);
console.log("TOON: \n" + toon2);

const back2 = TOON.toonToJson(toon2);
console.log("JSON AGAIN: \n" + JSON.stringify(back2, null, 2));

const toonm2 = TOON.jsonToToon(back2);
console.log("TOON m: \n" + toonm2);
console.log(toon2 == toonm2 );