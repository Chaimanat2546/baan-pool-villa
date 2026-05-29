-- Correct the existing online global settings row after the contact columns were added.
update public.site_settings
set
  bank_account_name = 'คุณ อาภัสรา จินดาวา',
  bank_name = 'ธนาคารกสิกรไทย',
  bank_account_number = '398-289-7482',
  phone_contacts = jsonb_build_array(
    jsonb_build_object('name', 'คุณเกม', 'phone', '0617485213', 'time', 'ช่วง 07.00-15.00'),
    jsonb_build_object('name', 'คุณโก้', 'phone', '0657329919', 'time', 'ช่วง 16.00-02.00')
  ),
  messenger_url = 'https://www.facebook.com/baanpoolvillas',
  line_id = '@baanpoolvilla',
  line_url = 'https://line.me/R/ti/p/@baanpoolvilla'
where id = 'global';

notify pgrst, 'reload schema';
