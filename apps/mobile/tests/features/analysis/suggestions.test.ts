import { candidatesToMarks } from '../../../src/features/analysis/suggestions';
import { suggestionSummary } from '../../../src/features/analysis/analysisText';

describe('candidatesToMarks', () => {
  it('turns candidates into one-shot suggestions and flags uncertain ones', () => {
    let next = 0;
    const marks = candidatesToMarks(
      [
        { id: 'c1', x: 10, y: 20, diameterPx: null, confidence: 0.9, uncertain: false },
        { id: 'c2', x: 30, y: 40, diameterPx: null, confidence: 0.5, uncertain: false },
        { id: 'c3', x: 50, y: 60, diameterPx: null, confidence: 0.95, uncertain: true },
      ],
      () => `m${(next += 1)}`,
    );
    expect(
      marks.map((mark) => [mark.id, mark.shots, mark.source, mark.uncertain, mark.candidateId]),
    ).toEqual([
      ['m1', 1, 'suggested', false, 'c1'],
      ['m2', 1, 'suggested', true, 'c2'],
      ['m3', 1, 'suggested', true, 'c3'],
    ]);
  });
});

describe('suggestionSummary', () => {
  it('reports found holes, none found, and photo warnings', () => {
    expect(suggestionSummary(2, [])).toBe('2 suggestions added. Check each one before confirming.');
    expect(suggestionSummary(0, [])).toBe('No new holes were found. Mark any hits yourself.');
    expect(suggestionSummary(1, ['glare', 'glare', 'blur'])).toContain('glare, blur');
  });

  it('says that the number columns were not searched and that unmarked holes are not misses', () => {
    const none = suggestionSummary(0, ['stickerEdges', 'numberColumnsSkipped']);
    expect(none).toContain('No new holes were found outside the number columns.');
    expect(none).toContain('The columns of printed numbers were not searched.');
    expect(none).toContain('never counted as a miss');
    expect(none).toContain('The analysis noticed: sticker edges that may look like holes.');
    expect(none).not.toContain('numberColumnsSkipped');
  });
});
