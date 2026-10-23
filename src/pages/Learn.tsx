import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Filter,
  Loader2,
  Play,
  Search,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { api, apiPost, errorMessage } from '../lib/api';

const categories = ['All', 'Data', 'Development', 'AI/ML', 'Design', 'Business'] as const;
const difficulties = ['Any level', 'Beginner', 'Intermediate', 'Advanced'] as const;
const priceOptions = [
  { value: 'any', label: 'Any price' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
] as const;
const ratingOptions = [
  { value: '0', label: 'Any rating' },
  { value: '4', label: '4.0+' },
  { value: '4.5', label: '4.5+' },
  { value: '4.8', label: '4.8+' },
] as const;
const sortOptions = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Top rated' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
] as const;

type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  instructor_name: string;
  rating: number;
  lessons_count: number;
  module_count: number;
  learner_count: number;
  price: number;
  enrolled: boolean;
  progress: number;
  tone?: string;
  glyph?: string;
  tag_class?: string;
  thumbnail_url?: string | null;
  status: string;
};

const fallbackTone = 'from-[#231451] via-[#141a3c] to-[#0d1424]';
const fallbackTag = 'text-primary-200 border-primary-300/20 bg-primary-500/10';

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

export default function Learn() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(query);
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>('Any level');
  const [minRating, setMinRating] = useState('0');
  const [pricing, setPricing] = useState<(typeof priceOptions)[number]['value']>('any');
  const [sort, setSort] = useState<(typeof sortOptions)[number]['value']>('recommended');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const isStudent = user?.role === 'student';
  const activeFilterCount = [
    difficulty !== 'Any level',
    minRating !== '0',
    pricing !== 'any',
    sort !== 'recommended',
  ].filter(Boolean).length;

  useEffect(() => {
    setSearch(query);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (category !== 'All') params.set('category', category);
        if (difficulty !== 'Any level') params.set('difficulty', difficulty);
        if (minRating !== '0') params.set('min_rating', minRating);
        if (pricing !== 'any') params.set('price', pricing);
        if (sort !== 'recommended') params.set('sort', sort);
        params.set('limit', '50');
        const data = await api<{ courses: Course[]; total: number }>(`/courses?${params.toString()}`);
        if (!cancelled) {
          setCourses(data.courses);
          setTotal(data.total);
        }
      } catch (caught) {
        if (!cancelled) setError(errorMessage(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, category, difficulty, minRating, pricing, sort]);

  const updateSearch = (value: string) => {
    setSearch(value);
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set('q', value);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    updateSearch('');
    setCategory('All');
    setDifficulty('Any level');
    setMinRating('0');
    setPricing('any');
    setSort('recommended');
  };

  const resume = useMemo(() => {
    const active = courses.find((course) => course.enrolled && course.progress > 0 && course.progress < 100);
    return active || courses.find((course) => course.enrolled) || null;
  }, [courses]);

  const openCourse = (course: Course) => {
    if (!course.enrolled) {
      showToast('Enroll first to unlock the lesson player.');
      return;
    }
    navigate(`/lesson?course=${course.id}`);
  };

  const enroll = async (course: Course) => {
    if (!isStudent) {
      showToast('Switch to a student demo account to enroll in courses.');
      return;
    }
    if (course.enrolled) {
      openCourse(course);
      return;
    }
    setEnrolling(course.id);
    try {
      await apiPost(`/courses/${course.id}/enroll`);
      setCourses((current) =>
        current.map((item) => (item.id === course.id ? { ...item, enrolled: true, progress: 0 } : item)),
      );
      showToast(`Enrolled · ${course.title}`);
    } catch (caught) {
      showToast(errorMessage(caught));
    } finally {
      setEnrolling(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-300/75">Explore</p>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
            Find your next <span className="text-gradient">deep dive.</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-white/35">
            AI-curated courses that adapt to how you learn, with grounded tutoring built into every lesson.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => showToast('Learning path opened · 4 courses mapped to your DSA goal.')}
            className="btn-ghost h-10 px-4 text-[11px]"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary-300/70" />
            Learning path
          </button>
          <button
            onClick={() => (resume ? navigate(`/lesson?course=${resume.id}`) : showToast('Enroll in a course to start learning.'))}
            className="btn-primary h-10 px-4 text-[11px]"
          >
            <Play className="h-3.5 w-3.5" />
            Resume learning
          </button>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-white/[0.07] bg-[#100d19] px-3.5 transition focus-within:border-primary-400/35 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.05)] sm:max-w-md">
            <Search className="h-4 w-4 shrink-0 text-white/25" />
            <input
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search courses, topics, instructors..."
              aria-label="Search courses"
              className="h-full min-w-0 flex-1 bg-transparent text-[11.5px] text-white/75 placeholder:text-white/20 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => updateSearch('')}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/30 transition hover:text-white/70"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen((current) => !current)}
            className={`relative flex h-11 items-center gap-2 rounded-xl border px-3.5 text-[10px] font-medium transition ${
              filtersOpen || activeFilterCount > 0
                ? 'border-primary-400/30 bg-primary-500/15 text-primary-200'
                : 'border-white/[0.07] bg-white/[0.02] text-white/35 hover:text-white/65'
            }`}
            aria-expanded={filtersOpen}
            aria-label="Open catalog filters"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary-400 px-1 text-[8px] font-bold text-[#0b0813]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-[10px] font-medium transition ${
                category === item
                  ? 'border-primary-400/30 bg-primary-500/15 text-primary-200'
                  : 'border-white/[0.06] bg-white/[0.02] text-white/30 hover:text-white/60'
              }`}
            >
              {item === 'All' ? 'All courses' : item}
            </button>
          ))}
        </div>
      </div>

      {filtersOpen && (
        <div className="mt-3 animate-fade-up rounded-2xl border border-white/[0.07] bg-[#100d19] p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.35fr_auto]">
            <label className="block">
              <span className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-white/28">Difficulty</span>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as (typeof difficulties)[number])} className="form-input h-9 text-[10px]">
                {difficulties.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-white/28">Rating</span>
              <select value={minRating} onChange={(event) => setMinRating(event.target.value)} className="form-input h-9 text-[10px]">
                {ratingOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-white/28">Price</span>
              <select value={pricing} onChange={(event) => setPricing(event.target.value as typeof pricing)} className="form-input h-9 text-[10px]">
                {priceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-white/28">Sort by</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="form-input h-9 text-[10px]">
                {sortOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <button onClick={clearFilters} className="btn-ghost h-9 self-end px-3 text-[9px]">
              <X className="h-3 w-3" /> Reset
            </button>
          </div>
        </div>
      )}

      <section className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-white">
              {query.trim() ? `Results for “${query.trim()}”` : category !== 'All' ? `${category} courses` : 'Recommended for you'}
            </h2>
            <p className="mt-1 text-[10px] text-white/25">
              {loading
                ? 'Loading the catalog…'
                : query.trim()
                  ? `${courses.length} ${courses.length === 1 ? 'course matches' : 'courses match'} your search`
                  : 'Picked from your goals, skill graph, and recent activity'}
            </p>
          </div>
          <span className="text-[9px] text-white/25">
            Showing {courses.length} of {total} courses
          </span>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-4 py-3 text-[10.5px] text-rose-200/80">
            {error}
          </div>
        )}

        {loading && courses.length === 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-[360px] animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
            ))}
          </div>
        ) : courses.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => {
              const completed = course.enrolled && course.progress === 100;
              const tag = course.tag_class || fallbackTag;
              return (
                <article
                  key={course.id}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.065] bg-[#100d19] transition hover:border-primary-400/20 hover:bg-[#141020]"
                >
                  <div
                    className={`relative h-[148px] overflow-hidden bg-gradient-to-br ${course.tone || fallbackTone}`}
                    style={
                      course.thumbnail_url
                        ? {
                            backgroundImage: `linear-gradient(180deg, rgba(8,6,15,0.25), rgba(8,6,15,0.7)), url(${course.thumbnail_url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : undefined
                    }
                  >
                    <div
                      className="absolute inset-0 opacity-[0.22]"
                      style={{
                        backgroundImage:
                          'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)',
                        backgroundSize: '16px 16px',
                      }}
                    />
                    <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/[0.05] blur-2xl" />
                    <div className="pointer-events-none absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-black/20 blur-2xl" />

                    <span className="absolute left-3 top-3 rounded-md border border-white/[0.09] bg-black/25 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-white/50 backdrop-blur">
                      {course.category}
                    </span>
                    <span
                      className={`absolute right-3 top-3 rounded-md border px-2 py-1 text-[7.5px] font-semibold uppercase tracking-[0.06em] backdrop-blur ${
                        completed
                          ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                          : course.enrolled
                            ? 'border-teal2/20 bg-teal2/10 text-teal-300'
                            : tag
                      }`}
                    >
                      {completed ? 'Completed' : course.enrolled ? 'Enrolled' : course.price > 0 ? inr(course.price) : 'Free'}
                    </span>

                    <button
                      onClick={() => openCourse(course)}
                      className="absolute inset-0 grid place-items-center"
                      aria-label={`Open ${course.title}`}
                    >
                      <span className={`font-mono text-[34px] font-semibold tracking-tight ${tag.split(' ').find((part) => part.startsWith('text-')) || 'text-primary-300/60'}`}>
                        {course.glyph || 'VC'}
                      </span>
                    </button>

                    {course.enrolled && (
                      <div className="absolute inset-x-0 bottom-0">
                        <div className="flex items-center justify-between px-3 pb-1.5 text-[7.5px] text-white/40">
                          <span>{course.progress}% complete</span>
                          <span>{Math.round((course.lessons_count * course.progress) / 100)} / {course.lessons_count} lessons</span>
                        </div>
                        <div className="h-1 bg-black/30">
                          <div
                            className="h-full bg-gradient-to-r from-primary-400 to-teal2"
                            style={{ width: `${course.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[9px] text-white/25">
                      <span className="flex items-center gap-1 text-amber-300/70">
                        <Star className="h-3 w-3 fill-amber-300/60" /> {Number(course.rating).toFixed(1)}
                      </span>
                      <span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {course.lessons_count} lessons
                      </span>
                      <span className="h-[2px] w-[2px] rounded-full bg-white/20" />
                      <span>{course.difficulty}</span>
                    </div>

                    <button
                      onClick={() => openCourse(course)}
                      className="mt-2 text-left font-display text-[13px] font-semibold leading-[1.45] text-white/80 transition group-hover:text-white"
                    >
                      {course.title}
                    </button>

                    <div className="mt-3 flex items-center gap-2">
                      <Avatar name={course.instructor_name || 'Vertexon'} size={20} />
                      <span className="text-[9.5px] text-white/30">{course.instructor_name}</span>
                      <span className="ml-auto flex items-center gap-1 text-[8px] text-white/20">
                        <BookOpen className="h-2.5 w-2.5" /> Certificate
                      </span>
                    </div>

                    <div className="mt-auto flex items-center gap-2 border-t border-white/[0.05] pt-3.5">
                      <button
                        onClick={() => enroll(course)}
                        disabled={enrolling === course.id}
                        className={course.enrolled || !isStudent ? 'btn-ghost h-9 flex-1 text-[10px]' : 'btn-primary h-9 flex-1 text-[10px]'}
                      >
                        {enrolling === course.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : course.enrolled ? (
                          <>
                            {completed ? <Check className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            {completed ? 'Review' : 'Continue'}
                          </>
                        ) : isStudent ? (
                          <>
                            <Sparkles className="h-3 w-3" />
                            Enroll now
                          </>
                        ) : (
                          <>Preview</>
                        )}
                      </button>
                      <button
                        onClick={() => showToast(`${course.title} · ${course.module_count} modules · ${course.lessons_count} lessons.`)}
                        className="icon-btn h-9 w-9 rounded-lg"
                        aria-label={`View ${course.title} syllabus`}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] px-6 py-14 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
              <Search className="h-5 w-5 text-white/30" />
            </span>
            <p className="mt-3 text-[12px] font-medium text-white/55">No courses match that search.</p>
            <p className="mt-1 text-[10px] text-white/25">Try a broader topic, instructor, or clear the filters.</p>
            <button onClick={clearFilters} className="btn-ghost mt-3 h-9 px-4 text-[10px]">
              Clear filters
            </button>
          </div>
        )}
      </section>

      <section className="relative mt-5 overflow-hidden rounded-2xl border border-primary-400/15 bg-gradient-to-br from-[#221646] via-[#15112a] to-[#0f0d18] p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-teal2/[0.07] blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-primary-300/70">Learning path</p>
            <h2 className="mt-1.5 font-display text-[19px] font-semibold text-white/90">
              Graph Algorithms → Interview Ready
            </h2>
            <p className="mt-1 text-[10.5px] leading-relaxed text-white/35">
              4 courses · 36 hours · personalized for your DSA goal and target interview loop.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {['DSA Foundations', 'Graph Algorithms', 'System Design', 'Mock Interviews'].map((stage, index) => (
                <span key={stage} className="flex items-center gap-1.5">
                  <span
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8.5px] ${
                      index === 0
                        ? 'border-teal2/20 bg-teal2/[0.08] text-teal-200/80'
                        : index === 1
                          ? 'border-primary-400/25 bg-primary-500/[0.12] text-primary-200/90'
                          : 'border-white/[0.07] bg-white/[0.02] text-white/30'
                    }`}
                  >
                    {index === 0 ? <Check className="h-2.5 w-2.5" /> : <span className="font-mono text-[7px]">{index + 1}</span>}
                    {stage}
                  </span>
                  {index < 3 && <ChevronRight className="h-2.5 w-2.5 text-white/15" />}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={() => showToast('Learning path opened · 4 courses mapped.')}
            className="btn-primary h-10 shrink-0 px-4 text-[10.5px]"
          >
            Explore path
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
}
