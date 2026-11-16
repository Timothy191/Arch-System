-- ==========================================================
-- Migration: 221_webhook_delivery_integration.sql
-- Description: Integrate webhook delivery triggers with the
--              current operational tables and ensure queued
--              deliveries are dispatchable by the portal worker.
-- ==========================================================

-- Replace the legacy queue function with an explicit, schema-qualified
-- implementation that covers the current delay-entry model.
CREATE OR REPLACE FUNCTION public.queue_webhook_delivery()
RETURNS TRIGGER SET search_path = '' AS $$
DECLARE
  event_type TEXT;
  payload JSONB;
  dept_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'daily_logs' THEN
    IF TG_OP = 'INSERT' THEN
      event_type := 'daily_log.created';
    ELSIF TG_OP = 'UPDATE' THEN
      event_type := 'daily_log.updated';
    ELSE
      RETURN NEW;
    END IF;
    dept_id := NEW.department_id;
    payload := jsonb_build_object(
      'id', NEW.id,
      'department_id', NEW.department_id,
      'log_date', NEW.log_date,
      'shift', NEW.shift,
      'notes', NEW.notes,
      'created_at', NEW.created_at
    );
  ELSIF TG_TABLE_NAME = 'breakdowns' THEN
    IF TG_OP = 'INSERT' THEN
      event_type := 'breakdown.created';
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        event_type := 'breakdown.completed';
      ELSE
        event_type := 'breakdown.updated';
      END IF;
    ELSE
      RETURN NEW;
    END IF;
    dept_id := NEW.department_id;
    payload := jsonb_build_object(
      'id', NEW.id,
      'department_id', NEW.department_id,
      'fleet_id', NEW.fleet_id,
      'machine_type', NEW.machine_type,
      'date_in', NEW.date_in,
      'time_in', NEW.time_in,
      'date_out', NEW.date_out,
      'time_out', NEW.time_out,
      'reason', NEW.reason,
      'status', NEW.status,
      'created_at', NEW.created_at
    );
  ELSIF TG_TABLE_NAME = 'safety_incidents' THEN
    IF TG_OP = 'INSERT' THEN
      event_type := 'safety_incident.created';
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        event_type := 'safety_incident.resolved';
      ELSE
        event_type := 'safety_incident.updated';
      END IF;
    ELSE
      RETURN NEW;
    END IF;
    dept_id := NEW.department_id;
    payload := jsonb_build_object(
      'id', NEW.id,
      'department_id', NEW.department_id,
      'incident_date', NEW.incident_date,
      'shift_type', NEW.shift_type,
      'incident_type', NEW.incident_type,
      'description', NEW.description,
      'location', NEW.location,
      'injured_parties', NEW.injured_parties,
      'status', NEW.status,
      'created_at', NEW.created_at
    );
  ELSIF TG_TABLE_NAME = 'production_logs' THEN
    IF TG_OP = 'INSERT' THEN
      event_type := 'production_log.created';
    ELSIF TG_OP = 'UPDATE' THEN
      event_type := 'production_log.updated';
    ELSE
      RETURN NEW;
    END IF;
    SELECT department_id INTO dept_id FROM public.daily_logs WHERE id = NEW.daily_log_id;
    payload := jsonb_build_object(
      'id', NEW.id,
      'daily_log_id', NEW.daily_log_id,
      'coal_tonnes', NEW.coal_tonnes,
      'waste_tonnes', NEW.waste_tonnes,
      'created_at', NEW.created_at
    );
  ELSIF TG_TABLE_NAME = 'delay_entries' THEN
    IF TG_OP = 'INSERT' THEN
      event_type := 'operational_delay.created';
    ELSIF TG_OP = 'UPDATE' THEN
      event_type := 'operational_delay.updated';
    ELSE
      RETURN NEW;
    END IF;
    SELECT mo.department_id INTO dept_id
    FROM public.machine_operations mo
    WHERE mo.id = NEW.machine_operation_id;
    payload := jsonb_build_object(
      'id', NEW.id,
      'machine_operation_id', NEW.machine_operation_id,
      'delay_category_id', NEW.delay_category_id,
      'delay_start_time', NEW.delay_start_time,
      'delay_end_time', NEW.delay_end_time,
      'duration_hours', NEW.duration_hours,
      'is_manual_override', NEW.is_manual_override,
      'description', NEW.description,
      'status', NEW.status,
      'created_at', NEW.created_at
    );
  ELSE
    RETURN NEW;
  END IF;

  FOR webhook IN
    SELECT id, url, secret
    FROM public.webhook_endpoints
    WHERE deleted_at IS NULL
      AND active = true
      AND event_type = ANY(event_types)
      AND (department_id IS NULL OR department_id = dept_id)
  LOOP
    INSERT INTO public.webhook_delivery_logs (
      webhook_endpoint_id,
      event_type,
      payload,
      response_status,
      response_body,
      delivered_at,
      retry_count,
      success,
      error_message
    ) VALUES (
      webhook.id,
      event_type,
      payload,
      NULL,
      NULL,
      NULL,
      0,
      false,
      'Queued for delivery'
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.queue_webhook_delivery() SET search_path = public, pg_temp;

-- Remove the deprecated operational_delays webhook triggers.
DROP TRIGGER IF EXISTS operational_delays_webhook_insert ON public.operational_delays;
DROP TRIGGER IF EXISTS operational_delays_webhook_update ON public.operational_delays;

-- Recreate triggers on the current operational tables.
DROP TRIGGER IF EXISTS daily_logs_webhook_insert ON public.daily_logs;
CREATE TRIGGER daily_logs_webhook_insert
  AFTER INSERT ON public.daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.queue_webhook_delivery();

DROP TRIGGER IF EXISTS daily_logs_webhook_update ON public.daily_logs;
CREATE TRIGGER daily_logs_webhook_update
  AFTER UPDATE ON public.daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.queue_webhook_delivery();

DROP TRIGGER IF EXISTS breakdowns_webhook_insert ON public.breakdowns;
CREATE TRIGGER breakdowns_webhook_insert
  AFTER INSERT ON public.breakdowns
  FOR EACH ROW EXECUTE FUNCTION public.queue_webhook_delivery();

DROP TRIGGER IF EXISTS breakdowns_webhook_update ON public.breakdowns;
CREATE TRIGGER breakdowns_webhook_update
  AFTER UPDATE ON public.breakdowns
  FOR EACH ROW EXECUTE FUNCTION public.queue_webhook_delivery();

DROP TRIGGER IF EXISTS production_logs_webhook_insert ON public.production_logs;
CREATE TRIGGER production_logs_webhook_insert
  AFTER INSERT ON public.production_logs
  FOR EACH ROW EXECUTE FUNCTION public.queue_webhook_delivery();

DROP TRIGGER IF EXISTS production_logs_webhook_update ON public.production_logs;
CREATE TRIGGER production_logs_webhook_update
  AFTER UPDATE ON public.production_logs
  FOR EACH ROW EXECUTE FUNCTION public.queue_webhook_delivery();

DROP TRIGGER IF EXISTS safety_incidents_webhook_insert ON public.safety_incidents;
CREATE TRIGGER safety_incidents_webhook_insert
  AFTER INSERT ON public.safety_incidents
  FOR EACH ROW EXECUTE FUNCTION public.queue_webhook_delivery();

DROP TRIGGER IF EXISTS safety_incidents_webhook_update ON public.safety_incidents;
CREATE TRIGGER safety_incidents_webhook_update
  AFTER UPDATE ON public.safety_incidents
  FOR EACH ROW EXECUTE FUNCTION public.queue_webhook_delivery();

DROP TRIGGER IF EXISTS delay_entries_webhook_insert ON public.delay_entries;
CREATE TRIGGER delay_entries_webhook_insert
  AFTER INSERT ON public.delay_entries
  FOR EACH ROW EXECUTE FUNCTION public.queue_webhook_delivery();

DROP TRIGGER IF EXISTS delay_entries_webhook_update ON public.delay_entries;
CREATE TRIGGER delay_entries_webhook_update
  AFTER UPDATE ON public.delay_entries
  FOR EACH ROW EXECUTE FUNCTION public.queue_webhook_delivery();

COMMENT ON FUNCTION public.queue_webhook_delivery() IS
  'Queues webhook deliveries for current operational events (daily logs, breakdowns, production logs, safety incidents, delay entries).';
