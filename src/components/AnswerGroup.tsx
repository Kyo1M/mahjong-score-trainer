import type { AnswerChoice } from '../domain/types'

type AnswerGroupProps = {
  title: string
  choices: AnswerChoice[]
  selectedKey: string | null
  disabled: boolean
  onSelect: (key: string) => void
}

export function AnswerGroup({
  title,
  choices,
  selectedKey,
  disabled,
  onSelect,
}: AnswerGroupProps) {
  return (
    <fieldset className="answer-group">
      <legend>{title}</legend>
      <div className="choice-list">
        {choices.map((choice) => (
          <button
            className={`choice ${selectedKey === choice.key ? 'choice--selected' : ''}`}
            key={choice.key}
            type="button"
            onClick={() => onSelect(choice.key)}
            disabled={disabled}
          >
            <span>{choice.label}</span>
            {choice.helper && <small>{choice.helper}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

type MultiAnswerGroupProps = {
  title: string
  choices: AnswerChoice[]
  selectedKeys: string[]
  disabled: boolean
  onToggle: (key: string) => void
}

export function MultiAnswerGroup({
  title,
  choices,
  selectedKeys,
  disabled,
  onToggle,
}: MultiAnswerGroupProps) {
  const selected = new Set(selectedKeys)

  return (
    <fieldset className="answer-group answer-group--wide">
      <legend>{title}</legend>
      <p className="answer-group__hint">ドラは役ではないので、ここでは選ばないでください。</p>
      <div className="choice-list choice-list--multi">
        {choices.map((choice) => (
          <button
            aria-pressed={selected.has(choice.key)}
            className={`choice ${selected.has(choice.key) ? 'choice--selected' : ''}`}
            key={choice.key}
            type="button"
            onClick={() => onToggle(choice.key)}
            disabled={disabled}
          >
            <span>{choice.label}</span>
            {choice.helper && <small>{choice.helper}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
