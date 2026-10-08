import { t } from '../../i18n/t';
import { useApp } from '../../stores/appStore';
import styles from './EnvironmentBanner.module.css';

/** Avisa si falta git o la CLI del agente. */
export function EnvironmentBanner() {
  const env = useApp((s) => s.environment);
  if (!env) return null;
  const messages: string[] = [];
  const gitHelp = {
    linux: 'environment.gitHelpLinux',
    darwin: 'environment.gitHelpDarwin',
    win32: 'environment.gitHelpWin32',
  } as const;
  if (!env.git.found) messages.push(`${t('environment.gitMissing')} ${t(gitHelp[env.platform])}`);
  if (env.agentCli.problem === 'not-found')
    messages.push(`${t('environment.agentMissing')} ${t('environment.agentHelp')}`);
  if (env.agentCli.problem === 'failed') messages.push(t('environment.agentFailed'));
  if (messages.length === 0) return null;
  return (
    <div className={styles.banner} role="alert">
      {messages.map((m) => (
        <span key={m}>{m}</span>
      ))}
    </div>
  );
}
