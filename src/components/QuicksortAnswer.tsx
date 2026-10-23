import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileCode2,
  FileText,
  HelpCircle,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import { useToast } from './Toast';

const codeSnippet = `# Standard Lomuto partition degrades on sorted input
# pivot = arr[high]  -> always the maximum element

def quicksort_first(arr, low, high):
    if low < high:
        pivot = arr[high]
        i = low - 1
        for j in range(low, high):
            if arr[j] <= pivot:
                i += 1
                arr[i], arr[j] = arr[j], arr[i]
        arr[i + 1], arr[high] = arr[high], arr[i + 1]
        quicksort_first(arr, low, i)
        quicksort_first(arr, i + 2, high)

# Fix: choose a random pivot, then partition
pivot_idx = random.randint(low, high)
arr[low], arr[pivot_idx] = arr[pivot_idx], arr[low]`;

export default function QuicksortAnswer() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeSnippet);
    } catch {
      // Clipboard access can be denied in preview environments.
    }
    setCopied(true);
    showToast('Code copied to clipboard.');
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="animate-fade-up space-y-3.5">
      <div className="flex items-center gap-2">
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-400 via-primary-500 to-teal2/80 shadow-[0_0_20px_-5px_rgba(139,92,246,0.85)]">
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold leading-none text-white/90">Vertexon AI Tutor</p>
          <p className="mt-1 text-[9.5px] leading-none text-white/30">Guided by Prof. Chen</p>
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[9px] font-medium text-teal-300/70">
          <span className="h-1 w-1 animate-pulse-soft rounded-full bg-teal2" />
          Grounded
        </span>
      </div>

      <p className="text-[13px] leading-[1.8] text-white/55">
        When using standard partition schemes that pick either the first or last element as the pivot, an already sorted
        array causes the chosen pivot to always be the absolute minimum or maximum element.
      </p>

      <div className="max-w-2xl rounded-xl border border-amber-400/20 bg-amber-400/[0.055] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[10.5px] font-semibold text-amber-300">
            <AlertTriangle className="h-3 w-3" />
            Unbalanced split
          </span>
          <code className="rounded border border-amber-400/15 bg-amber-400/10 px-2 py-1 font-mono text-[9.5px] text-amber-200">
            T(n) = T(n−1) + O(n)
          </code>
        </div>
        <div className="mt-2 flex h-[5px] gap-[2px] overflow-hidden rounded-sm bg-white/[0.05]">
          <span className="h-full w-[7%] rounded-sm bg-amber-400/60" />
          <span className="h-full flex-1 rounded-sm bg-gradient-to-r from-rose-400/70 to-rose-500/50" />
        </div>
        <div className="mt-1 flex justify-between text-[8.5px] text-white/30">
          <span>Left: 0 elements</span>
          <span>Right: n − 1 elements</span>
        </div>
      </div>

      <p className="text-[13px] leading-[1.8] text-white/55">
        Instead of dividing into balanced subproblems of <code className="rounded bg-white/[0.05] px-1 font-mono text-[8.5px] text-primary-200">O(log n)</code>{' '}
        depth, the recursion tree stretches into a sequential activation frame — computing{' '}
        <span className="font-medium text-primary-200">n + (n−1) + … + 1 ≈ O(n²)</span> comparisons.
      </p>

      <div className="overflow-hidden rounded-xl border border-white/[0.075] bg-[#090710]">
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <FileCode2 className="h-3.5 w-3.5 text-teal-300" />
          <span className="font-mono text-[10px] text-white/50">quicksort_first.py</span>
          <button
            onClick={copyCode}
            className="ml-auto flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[9px] text-white/40 transition hover:text-white/80"
          >
            {copied ? <Check className="h-3 w-3 text-teal-300" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="max-h-[220px] overflow-auto p-3.5 font-mono text-[10.5px] leading-[1.9] text-white/55">
          <code>
            <span className="text-teal-300/55"># Standard Lomuto partition degrades on sorted input</span>
            {'\n'}
            <span className="text-teal-300/55"># pivot = arr[high]  →  always the maximum element</span>
            {'\n\n'}
            <span className="text-[#c4b5fd]">def</span>{' '}
            <span className="text-[#93c5fd]">quicksort_first</span>
            <span className="text-white/50">(arr, low, high):</span>
            {'\n'}
            {'    '}<span className="text-[#c4b5fd]">if</span> low &lt; high:{'\n'}
            {'        '}pivot = arr[high]{'\n'}
            {'        '}i = low - 1{'\n'}
            {'        '}<span className="text-[#c4b5fd]">for</span> j{' '}
            <span className="text-[#c4b5fd]">in</span> range(low, high):{'\n'}
            {'            '}<span className="text-[#c4b5fd]">if</span> arr[j] &lt;= pivot:{'\n'}
            {'                '}i += 1{'\n'}
            {'                '}arr[i], arr[j] = arr[j], arr[i]{'\n'}
            {'        '}arr[i + 1], arr[high] = arr[high], arr[i + 1]{'\n'}
            {'        '}quicksort_first(arr, low, i){'\n'}
            {'        '}quicksort_first(arr, i + 2, high){'\n\n'}
            <span className="text-teal-300/55"># Fix: choose a random pivot before partitioning</span>
            {'\n'}
            pivot_idx = random.randint(low, high){'\n'}
            arr[low], arr[pivot_idx] = arr[pivot_idx], arr[low]
          </code>
        </pre>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
            Semantic vector sources (2)
          </p>
          <span className="font-mono text-[8.5px] text-teal-300/50">cosine · 0.92</span>
        </div>
        <div className="space-y-1.5">
          <button
            onClick={() => navigate('/lesson')}
            className="group flex w-full items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.018] px-3 py-2 text-left transition hover:border-primary-400/20 hover:bg-white/[0.035]"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-teal2/10">
              <PlayCircle className="h-3.5 w-3.5 text-teal-300" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-medium text-white/60 group-hover:text-white/85">
                Lecture 4.2: Quickselect & Pivot Selection
              </span>
              <span className="mt-0.5 block text-[8.5px] text-white/25">Timestamp 00:13:20 · Lecture</span>
            </span>
            <ExternalLink className="h-3 w-3 shrink-0 text-white/20" />
          </button>

          <button
            onClick={() => showToast('Opening Module 3 Algorithms.pdf · page 17')}
            className="group flex w-full items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.018] px-3 py-2 text-left transition hover:border-primary-400/20 hover:bg-white/[0.035]"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-500/10">
              <FileText className="h-3.5 w-3.5 text-primary-300" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-medium text-white/60 group-hover:text-white/85">
                Module 3 Algorithms.pdf
              </span>
              <span className="mt-0.5 block text-[8.5px] text-white/25">Page 17 · "Worst-Case Quicksort"</span>
            </span>
            <ExternalLink className="h-3 w-3 shrink-0 text-white/20" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl space-y-1.5 border-t border-white/[0.05] pt-3">
        <button
          onClick={() => showToast('Randomized partition highlighted in the code above.')}
          className="flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.018] px-2.5 py-2 text-left text-[11px] text-white/50 transition hover:border-white/[0.12] hover:text-white/80"
        >
          <Code2 className="h-3.5 w-3.5 text-primary-300" />
          Show randomized pivot code
        </button>
        <button
          onClick={() => navigate('/quiz')}
          className="flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.018] px-2.5 py-2 text-left text-[11px] text-white/50 transition hover:border-white/[0.12] hover:text-white/80"
        >
          <HelpCircle className="h-3.5 w-3.5 text-teal-300" />
          Quiz me on this (3 Qs)
        </button>
        <button
          onClick={() => showToast('Saved as flashcard · "Why quicksort degrades on sorted input"')}
          className="flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.018] px-2.5 py-2 text-left text-[11px] text-white/50 transition hover:border-white/[0.12] hover:text-white/80"
        >
          <BookmarkPlus className="h-3.5 w-3.5 text-amber-300" />
          Save as flashcard
        </button>
      </div>
    </div>
  );
}
