alter table public.site_settings
  add column if not exists bank_account_name text not null default 'คุณ อาภัสรา จินดาวา',
  add column if not exists bank_name text not null default 'ธนาคารกสิกรไทย',
  add column if not exists bank_account_number text not null default '398-289-7482',
  add column if not exists phone_contacts jsonb not null default
    '[
      {
        "name": "คุณเกม",
        "phone": "0617485213",
        "time": "ช่วง 07.00-15.00"
      },
      {
        "name": "คุณโก้",
        "phone": "0657329919",
        "time": "ช่วง 16.00-02.00"
      }
    ]'::jsonb,
  add column if not exists messenger_url text not null default 'https://www.facebook.com/baanpoolvillas',
  add column if not exists line_id text not null default '@baanpoolvilla',
  add column if not exists line_url text not null default 'https://line.me/R/ti/p/@baanpoolvilla';

update public.site_settings
set
  bank_account_name = 'คุณ อาภัสรา จินดาวา',
  bank_name = 'ธนาคารกสิกรไทย',
  bank_account_number = '398-289-7482',
  phone_contacts = '[
    {
      "name": "คุณเกม",
      "phone": "0617485213",
      "time": "ช่วง 07.00-15.00"
    },
    {
      "name": "คุณโก้",
      "phone": "0657329919",
      "time": "ช่วง 16.00-02.00"
    }
  ]'::jsonb,
  messenger_url = 'https://www.facebook.com/baanpoolvillas',
  line_id = '@baanpoolvilla',
  line_url = 'https://line.me/R/ti/p/@baanpoolvilla'
where id = 'global'
  and (
    bank_account_name = ''
    or bank_name = ''
    or bank_account_number = ''
    or phone_contacts = '[]'::jsonb
    or messenger_url = ''
    or line_id = ''
    or line_url = ''
  );

notify pgrst, 'reload schema';
