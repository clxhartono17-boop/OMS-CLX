/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS Pure Logic Unit Tests (Fast-feedback)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newTTId,
  makeSiteKey,
  calculateCycle,
  priorityFromIssue,
  categoryFromIssue,
  validateTechnicianTransition,
  calculateSlaRemaining,
  generateBulkWhatsAppText,
} from './omsLogic';

test('newTTId formats sequence and date correctly', () => {
  const d = new Date(2026, 9, 23); // 23 Oct 2026
  const id1 = newTTId(d, 1);
  assert.equal(id1, 'CLX/BSS/23/10/26/0001');

  const id99 = newTTId(d, 99);
  assert.equal(id99, 'CLX/BSS/23/10/26/0099');
});

test('makeSiteKey generates predictable keys', () => {
  const key1 = makeSiteKey('CAB-001', 'ST-JKT-01', 'Gambir St');
  assert.equal(key1, 'BSS|CAB-001');

  const key2 = makeSiteKey('', 'ST-BDG-02', 'Dago');
  assert.equal(key2, 'BSS|ST-BDG-02');

  const key3 = makeSiteKey('', '', 'Thamrin Plaza');
  assert.equal(key3, 'BSS|THAMRIN PLAZA');
});

test('calculateCycle correctly segments 15-to-15 periods', () => {
  // Day >= 15: 23 Oct 2026 -> Start 15 Oct 2026, End 15 Nov 2026
  const oct23 = new Date(2026, 9, 23);
  const cycle1 = calculateCycle(oct23);
  assert.equal(cycle1.startStr, '2026-10-15');
  assert.equal(cycle1.endStr, '2026-11-15');

  // Day < 15: 5 Nov 2026 -> Start 15 Oct 2026, End 15 Nov 2026
  const nov5 = new Date(2026, 10, 5);
  const cycle2 = calculateCycle(nov5);
  assert.equal(cycle2.startStr, '2026-10-15');
  assert.equal(cycle2.endStr, '2026-11-15');
});

test('priorityFromIssue handles operational status and keywords', () => {
  assert.equal(priorityFromIssue('Any issue', 'UNAVAILABLE'), 'Priority 1');
  assert.equal(priorityFromIssue('Normal', 'FAULTED'), 'Priority 2');
  assert.equal(priorityFromIssue('Routine', 'AVAILABLE'), 'Priority 3');

  // Fallback to issue text
  assert.equal(priorityFromIssue('BSS Offline and Cabinet Blocked'), 'Priority 1');
  assert.equal(priorityFromIssue('Battery warning cell voltage'), 'Priority 2');
  assert.equal(priorityFromIssue('Regular inspection'), 'Priority 3');
});

test('categoryFromIssue categorizes issues into standard buckets', () => {
  assert.equal(categoryFromIssue('BSS Offline and 4G lost'), 'Connectivity Issue');
  assert.equal(categoryFromIssue('Battery SOH < 70% degraded'), 'Battery Issue');
  assert.equal(categoryFromIssue('MCB tripped PLN down'), 'Power Issue');
  assert.equal(categoryFromIssue('Slot 3 lock jammed'), 'Slot/Hardware Issue');
  assert.equal(categoryFromIssue('Dust cleaning required'), 'Other');
});

test('validateTechnicianTransition enforces valid progression order', () => {
  // Valid step: ASSIGNED_TO_TECHNICIAN -> ACCEPT -> ACCEPTED
  const res1 = validateTechnicianTransition('ASSIGNED_TO_TECHNICIAN', 'ACCEPT');
  assert.equal(res1.valid, true);
  assert.equal(res1.nextStatus, 'ACCEPTED');

  // Invalid step: Cannot Clock In before On The Way
  const res2 = validateTechnicianTransition('ACCEPTED', 'CHECK_IN');
  assert.equal(res2.valid, false);
  assert.match(res2.error || '', /tidak dapat dilakukan/);

  // Valid on the way
  const res3 = validateTechnicianTransition('ACCEPTED', 'ON_THE_WAY');
  assert.equal(res3.valid, true);
  assert.equal(res3.nextStatus, 'ON_THE_WAY');

  // Valid check in
  const res4 = validateTechnicianTransition('ON_THE_WAY', 'CHECK_IN');
  assert.equal(res4.valid, true);
  assert.equal(res4.nextStatus, 'IN_PROGRESS');

  // Valid submit
  const res5 = validateTechnicianTransition('READY_TO_SUBMIT', 'SUBMIT');
  assert.equal(res5.valid, true);
  assert.equal(res5.nextStatus, 'COMPLETED_WAITING_REVIEW');
});

test('calculateSlaRemaining detects breached vs safe tickets', () => {
  const base = new Date('2026-10-23T10:00:00Z');

  // SLA is in 2 hours
  const safeSla = new Date('2026-10-23T12:00:00Z').toISOString();
  const safeRes = calculateSlaRemaining(safeSla, base);
  assert.equal(safeRes.isBreached, false);
  assert.equal(safeRes.hours, 2);

  // SLA was 1 hour ago
  const breachedSla = new Date('2026-10-23T09:00:00Z').toISOString();
  const breachRes = calculateSlaRemaining(breachedSla, base);
  assert.equal(breachRes.isBreached, true);
  assert.equal(breachRes.hours, 1);
});

test('generateBulkWhatsAppText outputs clean structured format', () => {
  const text = generateBulkWhatsAppText('PT MITRA JAYA PERSADA', [
    {
      ttId: 'CLX/BSS/23/10/26/0001',
      site: 'SPBU Sudirman 01',
      cabinet: 'CAB-JKT-101',
      issue: 'Battery pack disconnected',
      status: 'Pending',
      priority: 'Priority 1',
    },
  ]);

  assert.match(text, /CLX MS — BSS TROUBLE TICKET DISPATCH/);
  assert.match(text, /MITRA \/ TEAM : PT MITRA JAYA PERSADA/);
  assert.match(text, /\*TT\. ID\* = CLX\/BSS\/23\/10\/26\/0001/);
  assert.match(text, /\*Site Name\* = SPBU Sudirman 01/);
});
