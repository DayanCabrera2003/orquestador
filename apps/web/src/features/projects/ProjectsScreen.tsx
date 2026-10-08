import { useState } from 'react';
import { desktop } from '../../api/bridge';
import ui from '../../components/ui.module.css';
import { t } from '../../i18n/t';
import { cx } from '../../lib/cx';
import { useApp } from '../../stores/appStore';
import { Logo } from '../topbar/TopBar';
import styles from './ProjectsScreen.module.css';

function ProjectList() {
  const projects = useApp((s) => s.projects);
  const openProject = useApp((s) => s.openProject);
  const selectProject = useApp((s) => s.selectProject);
  const removeProject = useApp((s) => s.removeProject);
  const [path, setPath] = useState('');
  const bridge = desktop();

  return (
    <>
      <header className={styles.header}>
        <h1>{t('projects.title')}</h1>
        <p>{t('projects.subtitle')}</p>
      </header>
      <form
        className={styles.open}
        onSubmit={(e) => {
          e.preventDefault();
          if (path.trim()) void openProject(path.trim());
        }}
      >
        <input
          className={ui.input}
          value={path}
          placeholder={t('projects.pathPlaceholder')}
          aria-label={t('projects.pathLabel')}
          onChange={(e) => {
            setPath(e.target.value);
          }}
        />
        {bridge && (
          <button
            type="button"
            className={ui.btn}
            onClick={() => {
              void bridge.pickDirectory().then((dir) => {
                if (dir) void openProject(dir);
              });
            }}
          >
            {t('projects.browse')}
          </button>
        )}
        <button type="submit" className={cx(ui.btn, ui.primary)}>
          {t('projects.open')}
        </button>
      </form>
      {projects.length === 0 && <p className={styles.empty}>{t('projects.empty')}</p>}
      <ul className={styles.list}>
        {projects.map((p) => (
          <li key={p.id}>
            <button
              className={styles.item}
              onClick={() => {
                void selectProject(p.id);
              }}
            >
              <b>{p.name}</b>
              <span>{p.path}</span>
            </button>
            <button
              className={cx(ui.btn, ui.small)}
              onClick={() => {
                void removeProject(p.id);
              }}
            >
              {t('projects.remove')}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function FlowItem({ id, name, sessions }: { id: string; name: string; sessions: number }) {
  const openFlow = useApp((s) => s.openFlow);
  const renameFlow = useApp((s) => s.renameFlow);
  const duplicateFlow = useApp((s) => s.duplicateFlow);
  const deleteFlow = useApp((s) => s.deleteFlow);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [value, setValue] = useState(name);

  if (editing) {
    return (
      <li>
        <form
          className={styles.open}
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim())
              void renameFlow(id, value.trim()).then(() => {
                setEditing(false);
              });
          }}
        >
          <input
            className={ui.input}
            value={value}
            autoFocus
            aria-label={t('flows.rename')}
            onChange={(e) => {
              setValue(e.target.value);
            }}
          />
          <button type="submit" className={cx(ui.btn, ui.primary)}>
            {t('flows.save')}
          </button>
          <button
            type="button"
            className={ui.btn}
            onClick={() => {
              setEditing(false);
            }}
          >
            {t('flows.cancel')}
          </button>
        </form>
      </li>
    );
  }

  return (
    <li>
      <button
        className={styles.item}
        onClick={() => {
          openFlow(id);
        }}
      >
        <b className={styles.mono}>{name}</b>
        <span>{confirming ? t('flows.confirmDelete') : t('flows.sessions', { n: sessions })}</span>
      </button>
      {confirming ? (
        <>
          <button
            className={cx(ui.btn, ui.small)}
            onClick={() => {
              void deleteFlow(id);
            }}
          >
            {t('confirm.yes')}
          </button>
          <button
            className={cx(ui.btn, ui.small)}
            onClick={() => {
              setConfirming(false);
            }}
          >
            {t('confirm.no')}
          </button>
        </>
      ) : (
        <>
          <button
            className={cx(ui.btn, ui.small)}
            onClick={() => {
              setEditing(true);
            }}
          >
            {t('flows.rename')}
          </button>
          <button
            className={cx(ui.btn, ui.small)}
            onClick={() => {
              void duplicateFlow(id);
            }}
          >
            {t('flows.duplicate')}
          </button>
          <button
            className={cx(ui.btn, ui.small)}
            onClick={() => {
              setConfirming(true);
            }}
          >
            {t('flows.delete')}
          </button>
        </>
      )}
    </li>
  );
}

function FlowList() {
  const project = useApp((s) => s.projects.find((p) => p.id === s.projectId));
  const flows = useApp((s) => s.flows);
  const selectProject = useApp((s) => s.selectProject);
  const createFlow = useApp((s) => s.createFlow);
  const [name, setName] = useState('');
  if (!project) return null;

  return (
    <>
      <header className={styles.header}>
        <button
          className={styles.back}
          onClick={() => {
            void selectProject(null);
          }}
        >
          ← {t('flows.back')}
        </button>
        <h1>{project.name}</h1>
        <p className={styles.mono}>{project.path}</p>
      </header>
      <form
        className={styles.open}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void createFlow(name.trim());
        }}
      >
        <input
          className={ui.input}
          value={name}
          placeholder={t('flows.namePlaceholder')}
          aria-label={t('flows.newFlow')}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        <button type="submit" className={cx(ui.btn, ui.primary)}>
          {t('flows.create')}
        </button>
      </form>
      {flows.length === 0 && <p className={styles.empty}>{t('flows.empty')}</p>}
      <ul className={styles.list}>
        {flows.map((f) => (
          <FlowItem key={f.id} id={f.id} name={f.name} sessions={f.sessionCount} />
        ))}
      </ul>
    </>
  );
}

export function ProjectsScreen() {
  const projectId = useApp((s) => s.projectId);
  return (
    <div className={styles.screen}>
      <div className={styles.brand}>
        <Logo />
        <span>{t('app.name')}</span>
      </div>
      <main className={styles.card}>{projectId ? <FlowList /> : <ProjectList />}</main>
    </div>
  );
}
