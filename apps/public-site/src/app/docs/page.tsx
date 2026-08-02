import { launchChecklist, workosConsoleUrl } from "@/lib/site-data";

export default function DocsPage() {
  return (
    <main>
      <section className="page-hero">
        <span className="eyebrow">Docs</span>
        <h1>QiuAI WorkOS 快速使用说明</h1>
        <p>
          这份文档面向第一版正式发布，帮助用户理解安装、绑定企业、配置模型、同步知识库和运行数字员工/数字工厂的基本流程。
        </p>
      </section>

      <section className="section split-section">
        <div>
          <h2>上线后的标准使用路径</h2>
          <p>
            建议企业用户先在网页端完成注册和套餐开通，再回到 Windows
            客户端绑定设备。
          </p>
        </div>
        <ol className="checklist">
          {launchChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section className="section docs-grid">
        <article>
          <h2>模型配置</h2>
          <p>
            数字员工和数字工厂不会锁死具体模型。用户在桌面端配置供应商后，可以按文本、图片、语音等模型能力槽位进行切换。
          </p>
        </article>
        <article>
          <h2>知识库</h2>
          <p>
            企业知识库由网页端维护，设备端同步后与本地知识库合并使用。本地知识库可以为空，企业知识库建议维护完整
            PDF 版本。
          </p>
        </article>
        <article>
          <h2>数字员工</h2>
          <p>
            适合对话式办公任务，例如文档整理、表格整理、会议纪要、销售资料生成等，产物以
            Word、Excel 等文件交付。
          </p>
        </article>
        <article>
          <h2>数字工厂</h2>
          <p>
            适合批量生产任务，界面优先展示上传、参数、任务队列、输出队列、模型状态和工作日志，支持人工复核。
          </p>
        </article>
      </section>

      <section className="cta-section">
        <div>
          <h2>进入企业控制台</h2>
          <p>注册、购买套餐、绑定设备和维护企业知识库都在企业控制台完成。</p>
        </div>
        <a className="button button-primary" href={workosConsoleUrl}>
          打开企业控制台
        </a>
      </section>
    </main>
  );
}
