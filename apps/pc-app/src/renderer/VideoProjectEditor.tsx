import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  UploadOutlined
} from '@ant-design/icons';
import Button from 'antd/es/button';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Switch from 'antd/es/switch';
import Tag from 'antd/es/tag';
import Tooltip from 'antd/es/tooltip';
import Typography from 'antd/es/typography';
import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import type {
  DesktopToolInvocationRequest,
  DesktopToolInvocationResult
} from '../shared/desktop-api';
import type { DesktopArtifactSummary } from '../shared/desktop-contract';

interface VideoProjectSubtitle {
  start: number;
  end: number;
  text: string;
  clipId?: string;
}

interface VideoProjectClip {
  id: string;
  name: string;
  path: string;
  order: number;
  durationSeconds: number;
  audioPath?: string;
  subtitles?: VideoProjectSubtitle[];
}

interface VideoProjectAudioTrack {
  type: 'original' | 'ai_voiceover';
  clipId: string;
  path: string;
}

interface VideoProjectMusicTrack {
  type: 'music';
  path: string;
  name?: string;
  volume?: number;
}

interface VideoProject {
  version: string;
  projectType: string;
  status: string;
  format: 'mp4';
  sourceClips: VideoProjectClip[];
  intro?: { path: string; name?: string };
  outro?: { path: string; name?: string };
  transitions?: Array<{ afterClipId: string; type: string; durationMs: number }>;
  tracks: {
    video: Array<Record<string, unknown>>;
    audio: VideoProjectAudioTrack[];
    subtitles: VideoProjectSubtitle[];
    music: VideoProjectMusicTrack[];
  };
  voiceoverEnabled?: boolean;
  export: {
    format: 'mp4';
    ratio?: string;
    resolution?: string;
  };
  previewPath?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface VideoProjectEditorProps {
  artifact: DesktopArtifactSummary;
  workspaceId: string;
  onClose: () => void;
  onOpenLocal: (targetPath?: string) => void;
  onSaveAs: () => void;
  getPreviewUrl?: (path: string) => Promise<string>;
  desktopToolInvoker?: (
    request: DesktopToolInvocationRequest
  ) => Promise<DesktopToolInvocationResult>;
}

const transitionOptions = [
  { value: 'none', label: '无过场' },
  { value: 'fade', label: '柔和淡入淡出' },
  { value: 'black_fade', label: '黑场过渡' },
  { value: 'white_fade', label: '白场过渡' }
];

export default function VideoProjectEditor({
  artifact,
  workspaceId,
  onClose,
  onOpenLocal,
  onSaveAs,
  getPreviewUrl,
  desktopToolInvoker
}: VideoProjectEditorProps) {
  const [project, setProject] = useState<VideoProject>();
  const [previewSourceUrl, setPreviewSourceUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const [useVoiceover, setUseVoiceover] = useState(false);
  const musicFileInputRef = useRef<HTMLInputElement | null>(null);

  const audioByClipId = useMemo(
    () => new Map((project?.tracks.audio ?? []).map((track) => [track.clipId, track])),
    [project?.tracks.audio]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      setLoading(true);
      setNotice('');
      try {
        if (!artifact.sourcePayloadPath || !desktopToolInvoker) {
          throw new Error('视频工程文件不可用。');
        }

        const result = await desktopToolInvoker({
          workspaceId,
          toolId: 'local-filesystem',
          action: 'filesystem.read_text_file',
          input: { path: artifact.sourcePayloadPath },
          allowedRootPaths: [artifact.sourcePayloadPath]
        });
        if (!result.ok) {
          throw new Error(result.message ?? '视频工程读取失败。');
        }

        const content = typeof result.output?.content === 'string' ? result.output.content : '';
        const parsed = normalizeVideoProject(JSON.parse(content));
        if (!cancelled) {
          setProject(parsed);
          setUseVoiceover(
            parsed.voiceoverEnabled ??
              parsed.tracks.audio.some((track) => track.type === 'ai_voiceover')
          );
          setPreviewSourceUrl(artifact.localPath ?? '');
        }

        if (parsed.previewPath && getPreviewUrl) {
          const previewUrl = await getPreviewUrl(parsed.previewPath);
          if (!cancelled) {
            setPreviewSourceUrl(previewUrl);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(error instanceof Error ? error.message : '视频工程读取失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProject();
    return () => {
      cancelled = true;
    };
  }, [artifact.localPath, artifact.sourcePayloadPath, desktopToolInvoker, getPreviewUrl, workspaceId]);

  function updateProject(updater: (current: VideoProject) => VideoProject) {
    setProject((current) => (current ? updater(current) : current));
    setDirty(true);
    setNotice('');
  }

  function moveClip(index: number, direction: -1 | 1) {
    updateProject((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.sourceClips.length) {
        return current;
      }
      const sourceClips = [...current.sourceClips];
      const [clip] = sourceClips.splice(index, 1);
      if (!clip) {
        return current;
      }
      sourceClips.splice(nextIndex, 0, clip);
      return {
        ...current,
        sourceClips: sourceClips.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }))
      };
    });
  }

  function removeClip(index: number) {
    updateProject((current) => {
      const clip = current.sourceClips[index];
      if (!clip || current.sourceClips.length <= 1) {
        return current;
      }
      return {
        ...current,
        sourceClips: current.sourceClips
          .filter((_, clipIndex) => clipIndex !== index)
          .map((item, itemIndex) => ({ ...item, order: itemIndex + 1 })),
        tracks: {
          ...current.tracks,
          audio: current.tracks.audio.filter((track) => track.clipId !== clip.id),
          subtitles: current.tracks.subtitles.filter((subtitle) => subtitle.clipId !== clip.id)
        }
      };
    });
  }

  function updateSubtitle(clipId: string, subtitleIndex: number, patch: Partial<VideoProjectSubtitle>) {
    updateProject((current) => {
      const sourceClips = current.sourceClips.map((clip) => {
        if (clip.id !== clipId) {
          return clip;
        }
        const subtitles = (clip.subtitles ?? []).map((subtitle, index) =>
          index === subtitleIndex ? { ...subtitle, ...patch } : subtitle
        );
        return { ...clip, subtitles };
      });
      return {
        ...current,
        sourceClips,
        tracks: {
          ...current.tracks,
          subtitles: sourceClips.flatMap((clip) =>
            (clip.subtitles ?? []).map((subtitle) => ({ ...subtitle, clipId: clip.id }))
          )
        }
      };
    });
  }

  function toggleVoiceover(enabled: boolean) {
    if (enabled && !project?.tracks.audio.some((track) => track.type === 'ai_voiceover')) {
      setNotice('本工程没有已生成的 AI 口播音频，请返回参数设置开启 AI 口播后重新制作。');
      return;
    }
    setUseVoiceover(enabled);
    updateProject((current) => ({
      ...current,
      voiceoverEnabled: enabled
    }));
  }

  async function saveProject() {
    if (!project || !artifact.sourcePayloadPath || !desktopToolInvoker || saving) {
      return;
    }

    setSaving(true);
    try {
      const updatedProject = {
        ...project,
        status: 'editing',
        updatedAt: new Date().toISOString()
      };
      const result = await desktopToolInvoker({
        workspaceId,
        toolId: 'local-filesystem',
        action: 'filesystem.write_text_file',
        input: {
          path: artifact.sourcePayloadPath,
          content: JSON.stringify(updatedProject, null, 2),
          extension: 'json'
        },
        allowedRootPaths: [artifact.sourcePayloadPath]
      });
      if (!result.ok) {
        throw new Error(result.message ?? '视频工程保存失败。');
      }
      setProject(updatedProject);
      setDirty(false);
      setNotice('工程已保存。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '视频工程保存失败。');
    } finally {
      setSaving(false);
    }
  }

  async function exportProject() {
    if (!project || !desktopToolInvoker || exporting) {
      return;
    }

    setExporting(true);
    try {
      const sourceClips = project.sourceClips;
      const clipAudioPaths = useVoiceover
        ? sourceClips.map((clip) => {
            const track = audioByClipId.get(clip.id);
            return track?.type === 'ai_voiceover' ? track.path : '';
          })
        : [];
      const hasCompleteClipAudio = !useVoiceover || clipAudioPaths.every(Boolean);
      if (!hasCompleteClipAudio) {
        throw new Error('当前工程缺少部分 AI 口播音频，请关闭 AI 口播或重新制作工程。');
      }
      const result = await desktopToolInvoker({
        workspaceId,
        toolId: 'video-processing',
        action: 'video.compose_clips',
        input: {
          videoPaths: sourceClips.map((clip) => clip.path),
          sourceClipIds: sourceClips.map((clip) => clip.id),
          cutPlan: sourceClips.map((clip, index) => ({
            sourceIndex: index + 1,
            start: 0,
            end: clip.durationSeconds,
            label: clip.name
          })),
          ...(useVoiceover ? { clipAudioPaths } : {}),
          clipAudioPathsMode: 'source',
          introPath: project.intro?.path,
          outroPath: project.outro?.path,
          preserveIntroOutroAudio: true,
          preserveOriginalAudio: !useVoiceover,
          transitionEffect: readProjectTransition(project),
          musicPath: project.tracks.music[0]?.path,
          musicVolume: project.tracks.music[0]?.volume,
          subtitles: project.tracks.subtitles,
          outputRatio: project.export.ratio,
          outputResolution: project.export.resolution,
          folder: 'ai-video-production',
          fileName: artifact.title.replace(/\.mp4$/i, '')
        },
        allowedRootPaths: buildVideoProjectAllowedRootPaths(project, artifact)
      });
      if (!result.ok) {
        throw new Error(result.message ?? 'MP4 导出失败。');
      }
      const outputPath = typeof result.output?.localPath === 'string' ? result.output.localPath : '';
      if (!outputPath) {
        throw new Error('MP4 导出完成但没有返回文件路径。');
      }

      const nextProject = {
        ...project,
        status: 'editing',
        previewPath: outputPath,
        updatedAt: new Date().toISOString()
      };
      setProject(nextProject);
      setDirty(true);
      if (getPreviewUrl) {
        setPreviewSourceUrl(await getPreviewUrl(outputPath));
      }
      setNotice('MP4 已重新导出，点击保存工程后保留本次修改。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'MP4 导出失败。');
    } finally {
      setExporting(false);
    }
  }

  function attachMusicFile(file?: File) {
    if (!file || !window.qiuDesktop) {
      return;
    }
    const localPath = window.qiuDesktop.getPathForFile(file);
    if (!localPath) {
      setNotice('无法读取本地音频路径。');
      return;
    }
    updateProject((current) => ({
      ...current,
      tracks: {
        ...current.tracks,
        music: [{ type: 'music', path: localPath, name: file.name, volume: 0.16 }]
      }
    }));
  }

  function addMusic(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    attachMusicFile(file);
  }

  function handleMusicDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    attachMusicFile(event.dataTransfer.files?.[0]);
  }

  function removeMusic() {
    updateProject((current) => ({
      ...current,
      tracks: { ...current.tracks, music: [] }
    }));
  }

  const sourceUrl = previewSourceUrl || artifact.localPath || '';

  return (
    <aside className="artifact-workspace video-project-editor" aria-label="视频工程编辑器">
      <header className="artifact-workspace-header">
        <Space size={10} className="artifact-workspace-title">
          <span className="artifact-workspace-icon video">
            <PlayCircleOutlined />
          </span>
          <span className="artifact-workspace-title-main">
            <Typography.Text strong ellipsis title={artifact.title}>
              {artifact.title}
            </Typography.Text>
            <Typography.Text type="secondary">
              可编辑视频工程{dirty ? ' · 有未保存修改' : ''}
            </Typography.Text>
          </span>
        </Space>
        <Space size={4}>
          <Button
            size="small"
            type={dirty ? 'primary' : 'default'}
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => void saveProject()}
          >
            保存
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={() => void exportProject()}
          >
            导出 MP4
          </Button>
          {artifact.localPath ? (
            <Tooltip title="打开预览文件">
              <Button
                size="small"
                icon={<FolderOpenOutlined />}
                aria-label="打开预览文件"
                onClick={() => onOpenLocal(artifact.localPath)}
              />
            </Tooltip>
          ) : null}
          <Tooltip title="另存文件">
            <Button size="small" icon={<DownloadOutlined />} aria-label="另存文件" onClick={onSaveAs} />
          </Tooltip>
          <Tooltip title="关闭编辑器">
            <Button size="small" icon={<CloseOutlined />} aria-label="关闭编辑器" onClick={onClose} />
          </Tooltip>
        </Space>
      </header>

      {notice ? <div className="artifact-workspace-notice">{notice}</div> : null}

      {loading ? (
        <div className="artifact-workspace-loading">
          <Typography.Text type="secondary">正在打开视频工程...</Typography.Text>
        </div>
      ) : !project ? (
        <div className="artifact-workspace-empty">
          <Empty description={notice || '视频工程不可用'} />
        </div>
      ) : (
        <div className="video-project-editor-body">
          <div className="video-project-preview">
            {sourceUrl ? <video src={sourceUrl} controls preload="metadata" /> : <Empty description="暂无预览" />}
          </div>

          <section className="video-project-section video-project-timeline-section">
            <div className="video-project-section-header">
              <Typography.Text strong>编辑导轨</Typography.Text>
              <Typography.Text type="secondary">
                {formatDuration(getProjectDuration(project))}
              </Typography.Text>
            </div>
            <div className="video-project-timeline">
              <TimelineTrack label="视频">
                {project.intro ? (
                  <TimelineBlock label="片头" duration={1.5} totalDuration={getProjectDuration(project)} tone="asset" />
                ) : null}
                {project.sourceClips.map((clip) => (
                  <TimelineBlock
                    key={clip.id}
                    label={clip.name}
                    duration={clip.durationSeconds}
                    totalDuration={getProjectDuration(project)}
                    tone="video"
                  />
                ))}
                {project.outro ? (
                  <TimelineBlock label="片尾" duration={1.5} totalDuration={getProjectDuration(project)} tone="asset" />
                ) : null}
              </TimelineTrack>
              <TimelineTrack label="音频">
                {project.sourceClips.map((clip) => (
                  <TimelineBlock
                    key={`audio-${clip.id}`}
                    label={useVoiceover ? 'AI口播' : '原声'}
                    duration={clip.durationSeconds}
                    totalDuration={getProjectDuration(project)}
                    tone="audio"
                  />
                ))}
                {project.tracks.music[0] ? (
                  <TimelineBlock
                    label={project.tracks.music[0].name ?? '背景音乐'}
                    duration={getProjectDuration(project)}
                    totalDuration={getProjectDuration(project)}
                    tone="music"
                  />
                ) : null}
              </TimelineTrack>
              <TimelineTrack label="字幕">
                {project.sourceClips.flatMap((clip) => clip.subtitles ?? []).slice(0, 24).map((subtitle, index) => (
                  <TimelineBlock
                    key={`subtitle-${subtitle.clipId ?? index}-${index}`}
                    label={subtitle.text}
                    duration={Math.max(0.1, subtitle.end - subtitle.start)}
                    totalDuration={getProjectDuration(project)}
                    tone="subtitle"
                  />
                ))}
              </TimelineTrack>
            </div>
          </section>

          <section className="video-project-section">
            <div className="video-project-section-header">
              <Typography.Text strong>视频片段</Typography.Text>
              <Select
                size="small"
                value={readProjectTransition(project)}
                options={transitionOptions}
                onChange={(value) =>
                  updateProject((current) => ({
                    ...current,
                    transitions: current.sourceClips.slice(0, -1).map((clip) => ({
                      afterClipId: clip.id,
                      type: value,
                      durationMs: value === 'none' ? 0 : 350
                    }))
                  }))
                }
              />
            </div>
            <div className="video-project-clip-list">
              {project.sourceClips.map((clip, index) => (
                <div className="video-project-clip-row" key={clip.id}>
                  <span className="video-project-clip-order">{index + 1}</span>
                  <div className="video-project-clip-main">
                    <Typography.Text strong ellipsis title={clip.name}>
                      {clip.name}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {formatDuration(clip.durationSeconds)} · {(clip.subtitles ?? []).length} 条字幕
                    </Typography.Text>
                  </div>
                  <Space size={2}>
                    <Tooltip title="上移">
                      <Button
                        size="small"
                        icon={<ArrowUpOutlined />}
                        disabled={index === 0}
                        onClick={() => moveClip(index, -1)}
                      />
                    </Tooltip>
                    <Tooltip title="下移">
                      <Button
                        size="small"
                        icon={<ArrowDownOutlined />}
                        disabled={index === project.sourceClips.length - 1}
                        onClick={() => moveClip(index, 1)}
                      />
                    </Tooltip>
                    <Tooltip title="删除片段">
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={project.sourceClips.length <= 1}
                        onClick={() => removeClip(index)}
                      />
                    </Tooltip>
                  </Space>
                </div>
              ))}
            </div>
            <div className="video-project-asset-row">
              <Tag color="blue">片头</Tag>
              <Typography.Text type="secondary" ellipsis>
                {project.intro?.path ?? '未选择'}
              </Typography.Text>
              <Tag color="blue">片尾</Tag>
              <Typography.Text type="secondary" ellipsis>
                {project.outro?.path ?? '未选择'}
              </Typography.Text>
            </div>
          </section>

          <section className="video-project-section">
            <div className="video-project-section-header">
              <Typography.Text strong>声音与字幕</Typography.Text>
              <Space size={8}>
                <Typography.Text type="secondary">使用 AI 口播</Typography.Text>
                <Switch size="small" checked={useVoiceover} onChange={toggleVoiceover} />
              </Space>
            </div>
            <div className="video-project-subtitle-list">
              {project.sourceClips.map((clip) => (
                <div className="video-project-subtitle-group" key={clip.id}>
                  <Typography.Text strong>{clip.name}</Typography.Text>
                  {(clip.subtitles ?? []).map((subtitle, subtitleIndex) => (
                    <div className="video-project-subtitle-row" key={`${clip.id}-${subtitleIndex}`}>
                      <InputNumber
                        size="small"
                        min={0}
                        step={0.1}
                        value={subtitle.start}
                        onChange={(value) =>
                          updateSubtitle(clip.id, subtitleIndex, { start: Number(value ?? 0) })
                        }
                      />
                      <InputNumber
                        size="small"
                        min={0}
                        step={0.1}
                        value={subtitle.end}
                        onChange={(value) =>
                          updateSubtitle(clip.id, subtitleIndex, { end: Number(value ?? subtitle.end) })
                        }
                      />
                      <Input
                        size="small"
                        value={subtitle.text}
                        onChange={(event) =>
                          updateSubtitle(clip.id, subtitleIndex, { text: event.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="video-project-section">
            <div className="video-project-section-header">
              <Typography.Text strong>背景音乐</Typography.Text>
              <Space size={6}>
                <Button
                  size="small"
                  icon={<UploadOutlined />}
                  onClick={() => musicFileInputRef.current?.click()}
                >
                  添加音乐
                </Button>
                <input
                  ref={musicFileInputRef}
                  hidden
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                  onChange={(event) => void addMusic(event)}
                />
              </Space>
            </div>
            <div
              className="video-project-music-dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleMusicDrop}
            >
              <Typography.Text type="secondary">将音乐文件拖到这里，或点击上方按钮添加</Typography.Text>
            </div>
            {project.tracks.music.length > 0 ? (
              <div className="video-project-music-row">
                <Typography.Text ellipsis title={project.tracks.music[0]?.path}>
                  {project.tracks.music[0]?.name ?? project.tracks.music[0]?.path}
                </Typography.Text>
                <InputNumber
                  size="small"
                  min={0}
                  max={1}
                  step={0.01}
                  value={project.tracks.music[0]?.volume ?? 0.16}
                  onChange={(value) =>
                    updateProject((current) => ({
                      ...current,
                      tracks: {
                        ...current.tracks,
                        music: current.tracks.music.map((track, index) =>
                          index === 0 ? { ...track, volume: Number(value ?? 0.16) } : track
                        )
                      }
                    }))
                  }
                />
                <Button size="small" danger icon={<DeleteOutlined />} onClick={removeMusic} />
              </div>
            ) : (
              <Typography.Text type="secondary">未添加背景音乐</Typography.Text>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}

function normalizeVideoProject(value: unknown): VideoProject {
  const record = isRecord(value) ? value : {};
  const sourceClips = Array.isArray(record.sourceClips)
    ? record.sourceClips.flatMap((item, index) => {
        const clip = isRecord(item) ? item : {};
        const path = readString(clip.path);
        if (!path) {
          return [];
        }
        const subtitles = Array.isArray(clip.subtitles)
          ? clip.subtitles.flatMap((subtitle) => {
              const item = isRecord(subtitle) ? subtitle : {};
              const text = readString(item.text);
              const start = readNumber(item.start);
              const end = readNumber(item.end);
              return text && start !== undefined && end !== undefined && end > start
                ? [{ start, end, text, clipId: readString(item.clipId) ?? readString(clip.id) }]
                : [];
            })
          : [];
        return [{
          id: readString(clip.id) ?? `clip-${index + 1}`,
          name: readString(clip.name) ?? `视频片段 ${index + 1}`,
          path,
          order: readNumber(clip.order) ?? index + 1,
          durationSeconds: readNumber(clip.durationSeconds) ?? 0,
          audioPath: readString(clip.audioPath),
          subtitles
        }];
      })
    : [];
  const tracks = isRecord(record.tracks) ? record.tracks : {};
  const audio = Array.isArray(tracks.audio)
    ? tracks.audio.flatMap((item) => {
        const track = isRecord(item) ? item : {};
        const path = readString(track.path);
        const clipId = readString(track.clipId);
        return path && clipId
          ? [{ type: readString(track.type) === 'ai_voiceover' ? 'ai_voiceover' as const : 'original' as const, clipId, path }]
          : [];
      })
    : [];
  const music = Array.isArray(tracks.music)
    ? tracks.music.flatMap((item) => {
        const track = isRecord(item) ? item : {};
        const path = readString(track.path);
        return path
          ? [{ type: 'music' as const, path, name: readString(track.name), volume: readNumber(track.volume) ?? 0.16 }]
          : [];
      })
    : [];
  const transitions = Array.isArray(record.transitions)
    ? record.transitions.flatMap((item) => {
        const transition = isRecord(item) ? item : {};
        const afterClipId = readString(transition.afterClipId);
        return afterClipId
          ? [{
              afterClipId,
              type: readString(transition.type) ?? 'fade',
              durationMs: readNumber(transition.durationMs) ?? 350
            }]
          : [];
      })
    : [];
  return {
    version: readString(record.version) ?? '1.0.0',
    projectType: readString(record.projectType) ?? 'qiuai_video_project',
    status: readString(record.status) ?? 'editing',
    format: 'mp4',
    sourceClips,
    intro: readProjectAsset(record.intro),
    outro: readProjectAsset(record.outro),
    transitions,
    tracks: {
      video: Array.isArray(tracks.video) ? tracks.video.filter(isRecord) : [],
      audio,
      subtitles: sourceClips.flatMap((clip) => clip.subtitles ?? []),
      music
    },
    voiceoverEnabled:
      typeof record.voiceoverEnabled === 'boolean'
        ? record.voiceoverEnabled
        : audio.some((track) => track.type === 'ai_voiceover'),
    export: {
      format: 'mp4',
      ratio: readString(isRecord(record.export) ? record.export.ratio : undefined) ?? '16:9',
      resolution: readString(isRecord(record.export) ? record.export.resolution : undefined) ?? '1080p'
    },
    previewPath: readString(record.previewPath),
    createdAt: readString(record.createdAt),
    updatedAt: readString(record.updatedAt)
  };
}

function readProjectAsset(value: unknown): { path: string; name?: string } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const path = readString(value.path);
  return path ? { path, name: readString(value.name) } : undefined;
}

function readProjectTransition(project: VideoProject): string {
  return project.transitions?.[0]?.type ?? 'fade';
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  const normalized = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(normalized) ? normalized : undefined;
}

function getProjectDuration(project: VideoProject): number {
  const sourceDuration = project.sourceClips.reduce(
    (total, clip) => total + Math.max(0, clip.durationSeconds),
    0
  );
  return sourceDuration + (project.intro ? 1.5 : 0) + (project.outro ? 1.5 : 0);
}

function TimelineTrack({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="video-project-timeline-track">
      <span className="video-project-timeline-label">{label}</span>
      <div className="video-project-timeline-lane">{children}</div>
    </div>
  );
}

function TimelineBlock({
  label,
  duration,
  totalDuration,
  tone
}: {
  label: string;
  duration: number;
  totalDuration: number;
  tone: 'asset' | 'video' | 'audio' | 'music' | 'subtitle';
}) {
  const width = Math.max(7, Math.min(42, (duration / Math.max(0.1, totalDuration)) * 100));
  return (
    <div
      className={`video-project-timeline-block ${tone}`}
      style={{ flexBasis: `${width}%` }}
      title={label}
    >
      <span>{label}</span>
    </div>
  );
}

function buildVideoProjectAllowedRootPaths(
  project: VideoProject,
  artifact: DesktopArtifactSummary
): string[] {
  return [...new Set([
    artifact.sourcePayloadPath,
    artifact.localPath,
    project.previewPath,
    project.intro?.path,
    project.outro?.path,
    ...project.sourceClips.map((clip) => clip.path),
    ...project.sourceClips
      .map((clip) => clip.audioPath)
      .filter((value): value is string => Boolean(value)),
    ...project.tracks.audio.map((track) => track.path),
    ...project.tracks.music.map((track) => track.path)
  ].filter((value): value is string => Boolean(value && value.trim())))];
}
