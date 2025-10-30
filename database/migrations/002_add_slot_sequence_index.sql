-- Ensure slot_sequence column and unique indexes on target tables

do $$ begin
  begin alter table public.slot_status add column if not exists slot_sequence integer; exception when others then null; end;
  begin create unique index if not exists ux_slot_status_slot_sequence on public.slot_status(slot_sequence); exception when others then null; end;

  begin alter table public.slot_copangvip add column if not exists slot_sequence integer; exception when others then null; end;
  begin create unique index if not exists ux_slot_copangvip_slot_sequence on public.slot_copangvip(slot_sequence); exception when others then null; end;

  begin alter table public.slot_copangapp add column if not exists slot_sequence integer; exception when others then null; end;
  begin create unique index if not exists ux_slot_copangapp_slot_sequence on public.slot_copangapp(slot_sequence); exception when others then null; end;

  begin alter table public.slot_copangrank add column if not exists slot_sequence integer; exception when others then null; end;
  begin create unique index if not exists ux_slot_copangrank_slot_sequence on public.slot_copangrank(slot_sequence); exception when others then null; end;
end $$;


