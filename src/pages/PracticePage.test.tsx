import '@testing-library/jest-dom/vitest'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PracticePage } from './PracticePage'
import { practiceQuestions } from '../domain/questions'
import type { DifficultyFilter } from '../domain/types'

beforeAll(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

function renderPage() {
  const props = {
    question: practiceQuestions[0], // q-pinfu-ron-30-4-child（正解: 立直・断幺九・平和 / 30符 / 4翻 / 7700点）
    completedCount: 0,
    difficulty: 'mix' as DifficultyFilter,
    onSetDifficulty: vi.fn(),
    onAnswered: vi.fn(),
    onNext: vi.fn(),
  }
  render(
    <MemoryRouter>
      <PracticePage {...props} />
    </MemoryRouter>,
  )
  return props
}

// 正解を一通り選ぶヘルパー（以降のテストでも使う）
async function answerCanonical(user: ReturnType<typeof userEvent.setup>) {
  for (const label of ['立直', '断幺九', '平和', '30符', '4翻', '7700点']) {
    await user.click(screen.getByRole('button', { name: label }))
  }
}

describe('PracticePage layout', () => {
  it('renders fu before han in the answer grid', () => {
    renderPage()
    const legends = [...document.querySelectorAll('.answer-grid legend')].map(
      (el) => el.textContent,
    )
    expect(legends[0]).toBe('符')
    expect(legends[1]).toBe('翻 / 役満')
  })

  it('shows the spoiler-free title and a compact difficulty selector', async () => {
    const user = userEvent.setup()
    const props = renderPage()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      practiceQuestions[0].title,
    )
    await user.selectOptions(screen.getByLabelText('難易度'), 'starter')
    expect(props.onSetDifficulty).toHaveBeenCalledWith('starter')
  })

  it('grades the canonical answer as complete-correct', async () => {
    const user = userEvent.setup()
    const props = renderPage()
    await answerCanonical(user)
    await user.click(screen.getByRole('button', { name: /採点する/ }))
    expect(props.onAnswered).toHaveBeenCalledOnce()
    expect(screen.getByText('すべて正解です！')).toBeInTheDocument()
  })
})
