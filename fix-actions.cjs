const fs = require('fs');
const file = 'apps/portal/app/(departments)/access-control/actions.ts';
let code = fs.readFileSync(file, 'utf8');

const target1 = `      const { data, error } = await supabase.rpc('get_access_control_metrics_jsonb', {
        p_department_id: deptId,
      });

      if (error) {
        throw new DatabaseError('Failed to load access control metrics', {
          operation: 'rpc',
          context: { error: error.message },
        });
      }

      const metrics = (data as Record<string, unknown>)?.metrics as
        | Record<string, number>
        | undefined;

      const activeQrCodes = metrics?.active_qr_codes ?? 0;
      const totalEntities = metrics?.total_entities ?? 0;
      const entityCoverage =
        totalEntities && activeQrCodes ? Math.round((activeQrCodes / totalEntities) * 100) : 0;

      return {
        activeQrCodes,
        expiringSoon: metrics?.expiring_soon ?? 0,
        deniedToday: metrics?.denied_today ?? 0,
        accessEventsToday: metrics?.access_events_today ?? 0,
        expiredAssigned: metrics?.expired_assigned ?? 0,
        entityCoverage,
      };`;

const replacement1 = `      const { data, error } = await supabase.rpc('get_access_control_metrics_jsonb', {
        p_department_id: deptId,
      });

      let activeQrCodes = 0;
      let expiringSoon = 0;
      let deniedToday = 0;
      let accessEventsToday = 0;
      let expiredAssigned = 0;
      let totalEntities = 0;

      if (error && (error.message?.includes('schema cache') || error.code === 'PGRST202')) {
        // Fallback for when RPC is missing in schema cache
        const now = new Date();
        const today = new Date(now.toISOString().split('T')[0] + 'T00:00:00Z');
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const [{ count: activeCount }, { count: expiringCount }, { count: expiredCount }, { count: deniedCount }, { count: eventsCount }, { count: personnelCount }] = await Promise.all([
          supabase.from('badges').select('*', { count: 'exact', head: true }).eq('department_id', deptId).eq('is_active', true),
          supabase.from('badges').select('*', { count: 'exact', head: true }).eq('department_id', deptId).eq('is_active', true).lte('expires_at', in7Days.toISOString()).gt('expires_at', now.toISOString()),
          supabase.from('badges').select('*', { count: 'exact', head: true }).eq('department_id', deptId).eq('is_active', true).lt('expires_at', now.toISOString()),
          supabase.from('access_logs').select('*', { count: 'exact', head: true }).eq('department_id', deptId).eq('access_granted', false).gte('scanned_at', today.toISOString()),
          supabase.from('access_logs').select('*', { count: 'exact', head: true }).eq('department_id', deptId).gte('scanned_at', today.toISOString()),
          supabase.from('personnel').select('*', { count: 'exact', head: true }).eq('department_id', deptId)
        ]);
        
        activeQrCodes = activeCount || 0;
        expiringSoon = expiringCount || 0;
        expiredAssigned = expiredCount || 0;
        deniedToday = deniedCount || 0;
        accessEventsToday = eventsCount || 0;
        totalEntities = personnelCount || 0;
      } else if (error) {
        throw new DatabaseError('Failed to load access control metrics', {
          operation: 'rpc',
          context: { error: error.message },
        });
      } else {
        const metrics = (data as Record<string, unknown>)?.metrics as Record<string, number> | undefined;
        activeQrCodes = metrics?.active_qr_codes ?? 0;
        expiringSoon = metrics?.expiring_soon ?? 0;
        deniedToday = metrics?.denied_today ?? 0;
        accessEventsToday = metrics?.access_events_today ?? 0;
        expiredAssigned = metrics?.expired_assigned ?? 0;
        totalEntities = metrics?.total_entities ?? 0;
      }

      const entityCoverage = totalEntities && activeQrCodes ? Math.round((activeQrCodes / totalEntities) * 100) : 0;

      return {
        activeQrCodes,
        expiringSoon,
        deniedToday,
        accessEventsToday,
        expiredAssigned,
        entityCoverage,
      };`;

const target2 = `      const { data, error } = await supabase.rpc('get_access_control_metrics_jsonb', {
        p_department_id: deptId,
      });

      if (error) {
        throw new DatabaseError('Failed to load badge status distribution', {
          operation: 'rpc',
          context: { error: error.message },
        });
      }

      const dist = (data as Record<string, unknown>)?.badge_status_distribution as
        | Record<string, number>
        | undefined;

      return [
        { name: 'Active', value: dist?.active ?? 0, fill: 'var(--success)' },
        {
          name: 'Expiring Soon',
          value: dist?.expiring_soon ?? 0,
          fill: 'var(--warning)',
        },
        { name: 'Expired', value: dist?.expired ?? 0, fill: 'var(--danger)' },
        {
          name: 'Revoked',
          value: dist?.revoked ?? 0,
          fill: 'var(--muted-foreground)',
        },
      ];`;

const replacement2 = `      const { data, error } = await supabase.rpc('get_access_control_metrics_jsonb', {
        p_department_id: deptId,
      });

      let active = 0;
      let expiring_soon = 0;
      let expired = 0;
      let revoked = 0;

      if (error && (error.message?.includes('schema cache') || error.code === 'PGRST202')) {
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const [{ count: activeCount }, { count: expiringCount }, { count: expiredCount }, { count: revokedCount }] = await Promise.all([
          supabase.from('badges').select('*', { count: 'exact', head: true }).eq('department_id', deptId).eq('is_active', true).gt('expires_at', in7Days.toISOString()),
          supabase.from('badges').select('*', { count: 'exact', head: true }).eq('department_id', deptId).eq('is_active', true).lte('expires_at', in7Days.toISOString()).gt('expires_at', now.toISOString()),
          supabase.from('badges').select('*', { count: 'exact', head: true }).eq('department_id', deptId).eq('is_active', true).lt('expires_at', now.toISOString()),
          supabase.from('badges').select('*', { count: 'exact', head: true }).eq('department_id', deptId).eq('is_active', false)
        ]);
        
        active = activeCount || 0;
        expiring_soon = expiringCount || 0;
        expired = expiredCount || 0;
        revoked = revokedCount || 0;
      } else if (error) {
        throw new DatabaseError('Failed to load badge status distribution', {
          operation: 'rpc',
          context: { error: error.message },
        });
      } else {
        const dist = (data as Record<string, unknown>)?.badge_status_distribution as Record<string, number> | undefined;
        active = dist?.active ?? 0;
        expiring_soon = dist?.expiring_soon ?? 0;
        expired = dist?.expired ?? 0;
        revoked = dist?.revoked ?? 0;
      }

      return [
        { name: 'Active', value: active, fill: 'var(--success)' },
        { name: 'Expiring Soon', value: expiring_soon, fill: 'var(--warning)' },
        { name: 'Expired', value: expired, fill: 'var(--danger)' },
        { name: 'Revoked', value: revoked, fill: 'var(--muted-foreground)' },
      ];`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);

fs.writeFileSync(file, code);
