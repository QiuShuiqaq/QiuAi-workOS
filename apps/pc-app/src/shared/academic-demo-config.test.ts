import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAcademicDemoConfig,
  normalizeAcademicDemoParameters,
  renderAcademicDemoHtml,
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

test('academic demo section entries keep five sections and prefer manual content', () => {
  const config = buildAcademicDemoConfig({
    demoId: 'demo-current',
    generatedAt: '2026-08-07T00:00:00.000Z',
    taskTitle: '学术 Demo 测试',
    parameters: normalizeAcademicDemoParameters({
      projectName: '手动可控 Demo',
      researchDirection: '智能制造',
      keywords: ['可视化', '演示'],
      sectionEntries: [
        {
          type: 'conclusion_value',
          order: 1,
          title: '结论价值',
          depth: 'deep',
          manualContent: '这是用户人工确认的结论，不应被模型覆盖。'
        },
        {
          type: 'research_background',
          order: 2,
          enabled: false,
          title: '背景说明'
        }
      ]
    }),
    sources: [],
    dataProfiles: [],
    charts: [],
    extraction: {
      sections: [
        {
          type: 'conclusion_value',
          blocks: [{ title: '模型提取', body: '模型提取的结论。', confidence: 'high' }]
        }
      ]
    }
  });

  assert.equal(config.factoryTemplateId, 'factory_academic_project_demo_v1');
  assert.equal(config.roleCode, 'ai-factory-academic-project-demo-v1');
  assert.equal(config.project.researchDirection, '智能制造');
  assert.deepEqual(config.project.keywords, ['可视化', '演示']);
  assert.equal(config.sections.length, 5);
  assert.equal(config.sections[0]?.type, 'conclusion_value');
  assert.equal(config.sections[0]?.title, '结论价值');
  assert.equal(config.sections[0]?.depth, 'deep');
  assert.equal(config.sections[0]?.blocks[0]?.type, 'text');
  assert.match(config.sections[0]?.blocks[0]?.type === 'text' ? config.sections[0].blocks[0].body : '', /人工确认/);
  assert.equal(config.sections[1]?.type, 'research_background');
  assert.equal(config.sections[1]?.enabled, false);
});

test('legacy academic section types are merged into the current five sections', () => {
  const config = buildAcademicDemoConfig({
    demoId: 'demo-legacy-merge',
    generatedAt: '2026-08-07T00:00:00.000Z',
    taskTitle: '学术 Demo 兼容测试',
    parameters: normalizeAcademicDemoParameters({}),
    sources: [],
    dataProfiles: [
      {
        dataSourceId: 'table-1',
        fileName: 'results.csv',
        rowCount: 3,
        columnCount: 2,
        columns: [],
        warnings: []
      }
    ],
    charts: [],
    extraction: {
      sections: [
        {
          type: 'formula_reference',
          blocks: [{ title: '公式', body: '公式说明', confidence: 'high' }]
        },
        {
          type: 'dataset_overview',
          blocks: [{ title: '数据集', body: '数据来源明确', confidence: 'high' }]
        }
      ]
    }
  });

  const method = config.sections.find((section) => section.type === 'method_model');
  const data = config.sections.find((section) => section.type === 'data_analysis');
  assert.ok(method?.blocks.some((block) => block.type === 'text' && block.body === '公式说明'));
  assert.ok(data?.blocks.some((block) => block.type === 'text' && block.body === '数据来源明确'));
  assert.ok(data?.blocks.some((block) => block.type === 'metric'));
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

test('academic demo keeps manual formulas and real table previews usable in the Demo page', () => {
  const source: AcademicDemoSource = {
    id: 'table-1',
    fileName: 'results.csv',
    fileType: 'csv',
    localPath: 'D:/demo/results.csv',
    text: 'method,score\nA,88\nB,92\n'
  };
  const { dataProfiles, charts } = profileAcademicDemoTables({
    sources: [source],
    maxChartCount: 3
  });
  const config = buildAcademicDemoConfig({
    demoId: 'demo-renderable',
    generatedAt: '2026-08-08T00:00:00.000Z',
    taskTitle: '可展示 Demo',
    parameters: normalizeAcademicDemoParameters({
      sectionEntries: [
        {
          type: 'method_model',
          formulaDrafts: [
            {
              title: '损失函数',
              latex: 'L = -sum(y log(yhat))',
              explanation: '用于衡量预测误差。'
            }
          ]
        },
        {
          type: 'data_analysis',
          dataComparison: {
            enabled: true,
            chartType: 'bar',
            xColumn: 'method',
            yColumn: 'score',
            showTable: true
          }
        }
      ]
    }),
    sources: [source],
    dataProfiles,
    charts,
    extraction: {}
  });
  const method = config.sections.find((section) => section.type === 'method_model');
  const data = config.sections.find((section) => section.type === 'data_analysis');

  assert.ok(config.formulas.some((formula) => formula.title === '损失函数'));
  assert.ok(method?.blocks.some((block) => block.type === 'formula'));
  assert.ok(data?.blocks.some((block) => block.type === 'table'));
  assert.equal(config.charts.find((chart) => chart.dataSourceId === 'table-1')?.type, 'bar');
  assert.match(renderAcademicDemoHtml(config), /formula-display/);
  assert.match(renderAcademicDemoHtml(config), /data-table/);
});
