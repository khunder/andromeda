// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { declaredVariables, fileVariables } from './processVariables';

const BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Defs">
  <bpmn:itemDefinition id="Item_invoice" structureRef="file" />
  <bpmn:itemDefinition id="Item_amount" structureRef="number" />
  <bpmn:itemDefinition id="Item_scan" structureRef="file" />
  <bpmn:process id="Process_1">
    <bpmn:property id="P1" itemSubjectRef="Item_invoice" name="invoice" />
    <bpmn:property id="P2" itemSubjectRef="Item_amount" name="amount" />
    <bpmn:property id="P3" itemSubjectRef="Item_scan" name="scan" />
    <bpmn:property id="P4" name="note" />
    <bpmn:task id="Task_1">
      <bpmn:property id="P5" itemSubjectRef="Item_scan" name="taskLocal" />
    </bpmn:task>
  </bpmn:process>
</bpmn:definitions>`;

describe('process variables from BPMN', () => {
  it('reads the process variables with their declared type', () => {
    expect(declaredVariables(BPMN)).toEqual([
      { name: 'invoice', type: 'file' },
      { name: 'amount', type: 'number' },
      { name: 'scan', type: 'file' },
      { name: 'note', type: 'string' },
    ]);
  });

  it('lists the file variables only - not an activity\'s own properties', () => {
    expect(fileVariables(BPMN)).toEqual(['invoice', 'scan']);
  });

  it('returns nothing for invalid XML', () => {
    expect(fileVariables('<not xml')).toEqual([]);
  });
});
