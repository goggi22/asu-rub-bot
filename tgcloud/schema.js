import { table, integer, text, boolean, index } from 'sdk/db';

export const users = table('users', {
  tgId:      integer('tg_id').primaryKey(),
  groupId:   text('group_id'),
  groupName: text('group_name'),
  notify:    boolean('notify').default(true),
  isChat:    boolean('is_chat').default(false),
  lastMorning: text('last_morning'),
  lastNotify:  text('last_notify'),
  created:   integer('created_at', { mode: 'timestamp' }).default(19700101),
}, (t) => ({
  groupIdx: index('idx_users_group').on(t.groupId),
}));
