import type {
  AcademicChartSpec,
  AcademicColumnProfile,
  AcademicDemoEvidence,
  AcademicDemoSource,
  AcademicTableProfile
} from './academic-demo-config.js';

export function profileAcademicDemoTables(input: {
  sources: AcademicDemoSource[];
  maxChartCount?: number;
}): {
  dataProfiles: AcademicTableProfile[];
  charts: AcademicChartSpec[];
} {
  const tableSources = input.sources.filter((source) => source.fileType === 'csv' || source.fileType === 'xlsx');
  const dataProfiles = tableSources.flatMap((source) => profileTableSource(source));
  const charts = buildChartSpecs(dataProfiles, Math.max(0, Math.min(input.maxChartCount ?? 8, 20)));
  return { dataProfiles, charts };
}

export function buildAcademicDataProfileRows(profiles: AcademicTableProfile[]): string[][] {
  return [
    ['文件', '表/区域', '行数', '列数', '字段', '类型', '缺失数', '唯一值数', '最小值', '最大值', '均值'],
    ...profiles.flatMap((profile) =>
      profile.columns.map((column) => [
        profile.fileName,
        profile.sheetName ?? '',
        String(profile.rowCount),
        String(profile.columnCount),
        column.name,
        column.inferredType,
        String(column.missingCount),
        String(column.uniqueCount),
        column.min === undefined ? '' : String(column.min),
        column.max === undefined ? '' : String(column.max),
        column.mean === undefined ? '' : String(roundNumber(column.mean))
      ])
    )
  ];
}

function profileTableSource(source: AcademicDemoSource): AcademicTableProfile[] {
  const text = source.text?.trim();
  if (!text) {
    return [{
      dataSourceId: source.id,
      fileName: source.fileName,
      rowCount: 0,
      columnCount: 0,
      columns: [],
      warnings: ['未提取到可分析的表格文本。']
    }];
  }

  const rows = source.fileType === 'csv' ? parseDelimitedRows(text) : parseLooseTableRows(text);
  if (rows.length < 2) {
    return [{
      dataSourceId: source.id,
      fileName: source.fileName,
      rowCount: Math.max(0, rows.length - 1),
      columnCount: rows[0]?.length ?? 0,
      columns: [],
      warnings: ['表格行数不足，未生成字段统计。']
    }];
  }

  const headers = normalizeHeaders(rows[0], rows[1]?.length ?? rows[0].length);
  const records = rows.slice(1).filter((row) => row.some((cell) => cell.trim()));
  const columns = headers.map((header, index) => profileColumn(header, records.map((row) => row[index] ?? '')));
  const previewRows = records.slice(0, 12).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? '']))
  );
  return [{
    dataSourceId: source.id,
    fileName: source.fileName,
    rowCount: records.length,
    columnCount: headers.length,
    columns,
    previewRows,
    warnings: []
  }];
}

function parseDelimitedRows(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (char === ',' && !inQuote) {
      row.push(current.trim());
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuote) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(current.trim());
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }
    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell.trim())) {
    rows.push(row);
  }

  return rows.slice(0, 500);
}

function parseLooseTableRows(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 500);
  if (lines.some((line) => line.includes('\t'))) {
    return lines.map((line) => line.split('\t').map((cell) => cell.trim()));
  }
  if (lines.some((line) => line.includes(','))) {
    return lines.map((line) => line.split(',').map((cell) => cell.trim()));
  }
  return lines.map((line) => line.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean));
}

function normalizeHeaders(headers: string[], fallbackLength: number): string[] {
  const length = Math.max(headers.length, fallbackLength);
  return Array.from({ length }, (_, index) => {
    const header = headers[index]?.trim();
    return header || `字段${index + 1}`;
  });
}

function profileColumn(name: string, values: string[]): AcademicColumnProfile {
  const normalizedValues = values.map((value) => value.trim());
  const presentValues = normalizedValues.filter(Boolean);
  const uniqueValues = new Set(presentValues);
  const numericValues = presentValues.map(parseNumber).filter((value): value is number => value !== undefined);
  const datetimeValues = presentValues.filter((value) => !Number.isNaN(Date.parse(value)));
  const booleanValues = presentValues.filter((value) => ['true', 'false', '是', '否', 'yes', 'no', '0', '1'].includes(value.toLowerCase()));

  if (presentValues.length > 0 && numericValues.length / presentValues.length >= 0.85) {
    const sorted = [...numericValues].sort((left, right) => left - right);
    const mean = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
    return {
      name,
      inferredType: 'number',
      missingCount: normalizedValues.length - presentValues.length,
      uniqueCount: uniqueValues.size,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      stddev: Math.sqrt(numericValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numericValues.length)
    };
  }

  if (presentValues.length > 0 && datetimeValues.length / presentValues.length >= 0.7) {
    const timestamps = datetimeValues.map((value) => Date.parse(value)).sort((left, right) => left - right);
    return {
      name,
      inferredType: 'datetime',
      missingCount: normalizedValues.length - presentValues.length,
      uniqueCount: uniqueValues.size,
      min: new Date(timestamps[0]).toISOString().slice(0, 10),
      max: new Date(timestamps[timestamps.length - 1]).toISOString().slice(0, 10)
    };
  }

  if (presentValues.length > 0 && booleanValues.length / presentValues.length >= 0.9) {
    return {
      name,
      inferredType: 'boolean',
      missingCount: normalizedValues.length - presentValues.length,
      uniqueCount: uniqueValues.size,
      topValues: topValues(presentValues)
    };
  }

  const inferredType = uniqueValues.size <= Math.max(20, Math.ceil(presentValues.length * 0.35))
    ? 'category'
    : 'text';
  return {
    name,
    inferredType,
    missingCount: normalizedValues.length - presentValues.length,
    uniqueCount: uniqueValues.size,
    topValues: topValues(presentValues)
  };
}

function buildChartSpecs(profiles: AcademicTableProfile[], maxChartCount: number): AcademicChartSpec[] {
  const charts: AcademicChartSpec[] = [];
  for (const profile of profiles) {
    if (charts.length >= maxChartCount) {
      break;
    }
    const numericColumns = profile.columns.filter((column) => column.inferredType === 'number');
    const categoryColumns = profile.columns.filter((column) => column.inferredType === 'category' || column.inferredType === 'boolean');
    const datetimeColumns = profile.columns.filter((column) => column.inferredType === 'datetime');
    const evidence = buildLocalEvidence(profile);

    if (numericColumns.length > 0) {
      charts.push({
        id: `chart-${charts.length + 1}`,
        type: 'metric_cards',
        title: `${profile.fileName} 关键指标`,
        dataSourceId: profile.dataSourceId,
        metrics: numericColumns.slice(0, 4).map((column) => column.name),
        evidence
      });
    }
    if (charts.length >= maxChartCount) {
      break;
    }
    if (categoryColumns.length > 0 && numericColumns.length > 0) {
      charts.push({
        id: `chart-${charts.length + 1}`,
        type: 'bar',
        title: `${categoryColumns[0].name} 与 ${numericColumns[0].name} 对比`,
        dataSourceId: profile.dataSourceId,
        x: categoryColumns[0].name,
        y: numericColumns[0].name,
        evidence
      });
    }
    if (charts.length >= maxChartCount) {
      break;
    }
    if (datetimeColumns.length > 0 && numericColumns.length > 0) {
      charts.push({
        id: `chart-${charts.length + 1}`,
        type: 'line',
        title: `${numericColumns[0].name} 趋势`,
        dataSourceId: profile.dataSourceId,
        x: datetimeColumns[0].name,
        y: numericColumns[0].name,
        evidence
      });
    }
  }

  return charts.slice(0, maxChartCount);
}

function buildLocalEvidence(profile: AcademicTableProfile): AcademicDemoEvidence {
  return {
    sourceRefs: [{
      sourceId: profile.dataSourceId,
      fileName: profile.fileName,
      fileType: profile.fileName.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx',
      sheetName: profile.sheetName,
      columnNames: profile.columns.map((column) => column.name)
    }],
    confidence: 'high',
    extractionMethod: 'local_parser'
  };
}

function parseNumber(value: string): number | undefined {
  const cleaned = value.replace(/[%￥¥,\s]/g, '');
  const numberValue = Number(cleaned);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function topValues(values: string[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([value, count]) => ({ value, count }));
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}
