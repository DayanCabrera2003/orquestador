import {
  addSession,
  addSubagent,
  findSession,
  ModelTierSchema,
  ROLE_TEMPLATES,
  RoleSchema,
  setReportsTo,
  type ModelTier,
  type Role,
} from '@orquestador/core';
import { useState } from 'react';
import { Medal } from '../../components/Medal';
import { Modal } from '../../components/Modal';
import ui from '../../components/ui.module.css';
import { t } from '../../i18n/t';
import { cx } from '../../lib/cx';
import { useApp } from '../../stores/appStore';
import { useFlow } from '../../stores/flowStore';
import { useUi, type NewSessionRequest } from '../../stores/uiStore';
import styles from './NewSessionModal.module.css';

function suggestName(role: Role, count: number): string {
  const base = ROLE_TEMPLATES[role].defaultName;
  return role === 'ejecutor' || count > 0 ? `${base} ${String(count + 1)}` : base;
}

function NewSessionForm({ request }: { request: NewSessionRequest }) {
  const flow = useFlow((s) => s.flow);
  const apply = useFlow((s) => s.apply);
  const close = useUi((s) => s.closeNewSession);
  const select = useUi((s) => s.select);
  const pricing = useApp((s) => s.settings?.pricing);

  const initialRole: Role =
    request.link?.kind === 'subagent'
      ? 'revisor'
      : request.link?.kind === 'report'
        ? 'consultor'
        : 'ejecutor';
  const countOf = (role: Role) => flow?.sessions.filter((s) => s.role === role).length ?? 0;
  const [role, setRole] = useState<Role>(initialRole);
  const [model, setModel] = useState<ModelTier>(ROLE_TEMPLATES[initialRole].model);
  const [name, setName] = useState(suggestName(initialRole, countOf(initialRole)));
  const [instructions, setInstructions] = useState(ROLE_TEMPLATES[initialRole].instructions);

  if (!flow) return null;
  const linkedName = request.link ? findSession(flow, request.link.fromId)?.name : undefined;

  const chooseRole = (next: Role) => {
    if (name === suggestName(role, countOf(role)) || name.trim() === '')
      setName(suggestName(next, countOf(next)));
    setRole(next);
    setModel(ROLE_TEMPLATES[next].model);
    setInstructions(ROLE_TEMPLATES[next].instructions);
  };

  const create = () => {
    const id = crypto.randomUUID().slice(0, 8);
    const template = ROLE_TEMPLATES[role];
    const ok = apply((f) => {
      const added = addSession(f, {
        id,
        name: name.trim() || template.defaultName,
        model,
        role,
        instructions,
        permissions: template.permissions,
        budgetUsd: 2,
        position: request.position ?? { x: 0, y: 0 },
        reportsTo: null,
        subagents: [],
      });
      if (!added.ok || !request.link) return added;
      return request.link.kind === 'report'
        ? setReportsTo(added.value, request.link.fromId, id)
        : addSubagent(added.value, request.link.fromId, id);
    });
    if (ok) {
      close();
      select(id, 'config');
    }
  };

  return (
    <Modal
      title={t('newSession.title')}
      subtitle={t('newSession.subtitle')}
      onClose={close}
      footer={
        <>
          <button className={ui.btn} onClick={close}>
            {t('newSession.cancel')}
          </button>
          <button className={cx(ui.btn, ui.primary)} onClick={create}>
            {t('newSession.create')}
          </button>
        </>
      }
    >
      <div className={styles.models}>
        {ModelTierSchema.options.map((m) => (
          <button
            key={m}
            type="button"
            className={cx(styles.card, m === model && styles.on)}
            onClick={() => {
              setModel(m);
            }}
          >
            <Medal model={m} />
            <div>
              <b>{t(`model.${m}`)}</b> <span className={styles.tier}>{t(`model.${m}Tier`)}</span>
            </div>
            <p>{t(`model.${m}Use`)}</p>
            {pricing && (
              <span className={styles.price}>
                {t('newSession.perMillion', {
                  input: pricing[m].inputPerMTok,
                  output: pricing[m].outputPerMTok,
                })}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={ui.field}>
        <span className={ui.label}>{t('newSession.role')}</span>
        <div className={styles.roles}>
          {RoleSchema.options.map((r) => (
            <button
              key={r}
              type="button"
              className={cx(styles.role, r === role && styles.roleOn)}
              onClick={() => {
                chooseRole(r);
              }}
            >
              {t(`role.${r}`)}
            </button>
          ))}
        </div>
      </div>

      <label className={ui.field}>
        <span className={ui.label}>{t('newSession.name')}</span>
        <input
          className={ui.input}
          value={name}
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create();
          }}
        />
      </label>

      <label className={ui.field}>
        <span className={ui.label}>{t('newSession.instructions')}</span>
        <textarea
          className={ui.input}
          rows={4}
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
          }}
        />
      </label>

      {request.link && linkedName && (
        <p className={styles.hint}>
          {request.link.kind === 'subagent'
            ? t('newSession.willBeSubagentOf', { name: linkedName })
            : t('newSession.willReceiveReportsFrom', { name: linkedName })}
        </p>
      )}
    </Modal>
  );
}

export function NewSessionModal() {
  const request = useUi((s) => s.newSession);
  return request ? <NewSessionForm request={request} /> : null;
}
