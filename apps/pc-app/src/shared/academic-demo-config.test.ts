import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAcademicDemoConfig,
  normalizeAcademicDemoParameters,
  type AcademicDemoSource
} from './academic-demo-config.js';
import { profileAcademicDemoTables } from './academic-demo-data-analysis.js';

test('academic demo parameters use conservative defaults and clamp limits', () => {
  const parameters = normalizeAcademicDemoParameters({
    demoDurationMinutes: 99,
    maxFormulaCount: 99,
    maxChartCount: -5,
    maxExperimentComparisonCount: 200,
    enableLoadingAnimation: false,
    language: 'en-US'
  });

  assert.equal(parameters.projectType, 'academic_research');
  assert.equal(parameters.audience, 'judges');
  assert.equal(parameters.demoDurationMinutes, 15);
  assert.equal(parameters.maxFormulaCount, 20);
  assert.equal(parameters.maxChartCount, 0);
  assert.equal(parameters.maxExperimentComparisonCount, 20);
  assert.equal(parameters.enableLoadingAnimation, false);
  assert.equal(parameters.enableInteractiveSimulation, true);
  assert.equal(parameters.language, 'en-US');
});

test('academic demo config keeps low-confidence extracted text out of formal sections', () => {
  const sources: AcademicDemoSource[] = [
    {
      id: 'source-1',
      fileName: 'project.docx',
      fileType: 'docx',
      localPath: 'D:/demo/project.docx',
      text: '项目研究背景明确。'
    }
  ];
  const config = buildAcademicDemoConfig({
    demoId: 'demo-1',
    generatedAt: '2026-08-07T00:00:00.000Z',
    taskTitle: '学术 Demo 测试',
    parameters: normalizeAcademicDemoParameters({
      projectName: '可信项目',
      enableInteractiveSimulation: false
    }),
    sources,
    dataProfiles: [],
    charts: [],
    extraction: {
      sections: [
        {
          type: 'research_background',
          blocks: [
            { title: '可信背景', body: '明确来源的研究背景。', confidence: 'high' },
            { title: '不可靠背景', body: '低置信度内容不能进入正式 Demo。', confidence: 'low' }
          ]
        }
      ]
    }
  });
  const background = config.sections.find((section) => section.type === 'research_background');

  assert.ok(background);
  assert.equal(background.blocks.length, 1);
  assert.equal(background.blocks[0]?.type, 'text');
  assert.match(background.blocks[0]?.type === 'text' ? background.blocks[0].body : '', /明确来源/);
});

test('academic demo table profiling uses real CSV values for data profiles and chart suggestions', () => {
  const { dataProfiles, charts } = profileAcademicDemoTables({
    maxChartCount: 3,
    sources: [
      {
        id: 'table-1',
        fileName: 'results.csv',
        fileType: 'csv',
        localPath: 'D:/demo/results.csv',
        text: 'date,method,score\n2026-01-01,A,88\n2026-01-02,B,92\n2026-01-03,A,91\n'
      }
    ]
  });

  assert.equal(dataProfiles.length, 1);
  assert.equal(dataProfiles[0]?.rowCount, 3);
  assert.equal(dataProfiles[0]?.columnCount, 3);
  assert.equal(dataProfiles[0]?.columns.find((column) => column.name === 'score')?.inferredType, 'number');
  assert.ok(charts.length > 0);
  assert.ok(charts.every((chart) => chart.dataSourceId === 'table-1'));
});
