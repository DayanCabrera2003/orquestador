import {
  addSubagent,
  findSession,
  ModelTierSchema,
  PermissionsSchema,
  removeSubagent,
  ROLE_TEMPLATES,
  RoleSchema,
  setReportsTo,
  type Permissions,
  type SessionNode,
} from '@orquestador/core';
import { useEffect, useState } from 'react';
import { request } from '../../api/http';
import { Medal } from '../../components/Medal';
import ui from '../../components/ui.module.css';
import { t } from '../../i18n/t';
import { cx } from '../../lib/cx';
import { useFlow } from '../../stores/flowStore';
import styles from './SessionPanel.module.css';

const PERMISSION_KEYS = PermissionsSchema.keyof().options;

export function ConfigTab({ sessionId }: { sessionId: string }) {
  const flow = useFlow((s) => s.flow);
  const apply = useFlow((s) => s.apply);
  const pending = useFlow((s) => s.pending);
  const [composed, setComposed] = useState('');
  const session = flow ? findSession(flow, sessionId) : undefined;
  const [name, setName] = useState(session?.name ?? '');
  const savedName = session?.name;

  useEffect(() => {
    if (savedName !== undefined) setName(savedName);
  }, [sessionId, savedName]);

  const flowId = flow?.id;
  useEffect(() => {
    if (!flowId || pending) return;
    request('composedInstructions', { flowId, sessionId })
      .then((r) => {
        setComposed(r.text);
      })
      .catch(() => {
        setComposed('');
      });
  }, [flowId, sessionId, pending, flow]);

  if (!flow || !session) return null;
  const others = flow.sessions.filter((s) => s.id !== sessionId);
  const update = (patch: Partial<SessionNode>) =>
    apply((f) => ({
      ...f,
      sessions: f.sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s)),
    }));

  return (
    <div className={styles.body}>
      <div className={styles.form}>
        <label className={ui.field}>
          <span className={ui.label}>{t('panel.fieldName')}</span>
          <input
            className={ui.input}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) update({ name: e.target.value });
            }}
          />
        </label>

        <div className={ui.field}>
          <span className={ui.label}>{t('panel.fieldModel')}</span>
          <div className={styles.seg}>
            {ModelTierSchema.options.map((m) => (
              <button
                key={m}
                type="button"
                className={cx(styles.segBtn, m === session.model && styles.segOn)}
                onClick={() => update({ model: m })}
              >
                <Medal model={m} size="sm" />
                <b>{t(`model.${m}`)}</b>
                <em>{t(`model.${m}Tier`)}</em>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.row2}>
          <label className={ui.field}>
            <span className={ui.label}>{t('panel.fieldRole')}</span>
            <select
              className={ui.input}
              value={session.role}
              onChange={(e) => {
                update({ role: RoleSchema.parse(e.target.value) });
              }}
            >
              {RoleSchema.options.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <div className={ui.field}>
            <span className={ui.label}>&nbsp;</span>
            <button
              type="button"
              className={ui.btn}
              onClick={() => {
                const tpl = ROLE_TEMPLATES[session.role];
                update({
                  instructions: tpl.instructions,
                  permissions: tpl.permissions,
                  model: tpl.model,
                });
              }}
            >
              {t('panel.applyTemplate')}
            </button>
          </div>
        </div>

        <label className={ui.field}>
          <span className={ui.label}>{t('panel.fieldInstructions')}</span>
          <textarea
            className={ui.input}
            rows={6}
            value={session.instructions}
            onChange={(e) => update({ instructions: e.target.value })}
          />
        </label>

        <div className={styles.row2}>
          <label className={ui.field}>
            <span className={ui.label}>{t('panel.fieldReportsTo')}</span>
            <select
              className={ui.input}
              value={session.reportsTo ?? ''}
              onChange={(e) => {
                apply((f) => setReportsTo(f, sessionId, e.target.value || null));
              }}
            >
              <option value="">{t('panel.reportsToUser')}</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.field}>
            <span className={ui.label}>{t('panel.fieldBudget')}</span>
            <input
              className={ui.input}
              type="number"
              min={0}
              step={0.5}
              value={session.budgetUsd}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 0) update({ budgetUsd: v });
              }}
            />
          </label>
        </div>

        <div className={ui.field}>
          <span className={ui.label}>{t('panel.fieldSubagents')}</span>
          <div className={styles.chips}>
            {session.subagents.map((id) => {
              const sub = findSession(flow, id);
              if (!sub) return null;
              return (
                <span key={id} className={styles.chip}>
                  <Medal model={sub.model} size="xs" />
                  {sub.name}
                  <button
                    type="button"
                    aria-label={t('panel.removeSubagent', { name: sub.name })}
                    onClick={() => apply((f) => removeSubagent(f, sessionId, id))}
                  >
                    ×
                  </button>
                </span>
              );
            })}
            <select
              className={cx(ui.input, styles.addSub)}
              value=""
              onChange={(e) => {
                if (e.target.value) apply((f) => addSubagent(f, sessionId, e.target.value));
              }}
            >
              <option value="">{t('panel.addSubagent')}</option>
              {others
                .filter((o) => !session.subagents.includes(o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className={ui.field}>
          <span className={ui.label}>{t('panel.fieldPermissions')}</span>
          <div className={styles.perms}>
            {PERMISSION_KEYS.map((key: keyof Permissions) => (
              <label key={key} className={styles.switch}>
                <input
                  type="checkbox"
                  checked={session.permissions[key]}
                  onChange={(e) =>
                    update({ permissions: { ...session.permissions, [key]: e.target.checked } })
                  }
                />
                <i />
                {t(`permission.${key}`)}
              </label>
            ))}
          </div>
        </div>

        <div className={ui.field}>
          <span className={ui.label}>{t('panel.composed')}</span>
          <pre className={styles.composed}>{composed}</pre>
        </div>
      </div>
    </div>
  );
}
