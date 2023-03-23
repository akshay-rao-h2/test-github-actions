const core = require('@actions/core')
const github = require('@actions/github')
// const fetch = require('node-fetch');
const chatToken =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik1UaEVOVUpHTkVNMVFURTRNMEZCTWpkQ05UZzVNRFUxUlRVd1FVSkRNRU13UmtGRVFrRXpSZyJ9.eyJodHRwczovL2FwaS5vcGVuYWkuY29tL3Byb2ZpbGUiOnsiZW1haWwiOiJyYWh1bC4xMjIyOTNAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJodHRwczovL2FwaS5vcGVuYWkuY29tL2F1dGgiOnsidXNlcl9pZCI6InVzZXItOGYxZmxOWmNIOWQ5dDBNU3FGSEhVbDN1In0sImlzcyI6Imh0dHBzOi8vYXV0aDAub3BlbmFpLmNvbS8iLCJzdWIiOiJnb29nbGUtb2F1dGgyfDExNzc1NTY4NTE3Mzc5NDYxNDQ1MiIsImF1ZCI6WyJodHRwczovL2FwaS5vcGVuYWkuY29tL3YxIiwiaHR0cHM6Ly9vcGVuYWkub3BlbmFpLmF1dGgwYXBwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE2Nzk1NzgwMDEsImV4cCI6MTY4MDc4NzYwMSwiYXpwIjoiVGRKSWNiZTE2V29USHROOTVueXl3aDVFNHlPbzZJdEciLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIG1vZGVsLnJlYWQgbW9kZWwucmVxdWVzdCBvcmdhbml6YXRpb24ucmVhZCBvZmZsaW5lX2FjY2VzcyJ9.oNHKkRg-TRTvxTo4sLY0pKhOB745umCs3LtvHAFrjgL4iwtNVl4qz1Kvfjn8Hxpu95cJK_5Kxk0CD03-iG5DV10UTIU6w1fHi-iW4E9RvAN2Au5KZ-GwvSHLDbn4prz9xlvzYa8BEE1N00MIyFc_KI3I9JK5CyMdOcTuWu9-LGClL33wR-624Q1xfPhvw10G50jFMhaw3PGUTkDaScTdQDFFmM_Ia25DtmPovB25m1qUvGSNu1EIycQsKv-tXLF2avtvP9533001RYi6gjBFKojyyFMKtZdsWaLJ_nxGhs2BBWWan_KSwfjmZaS-pnLIAfrrHOWVKaUSWHsXzPXP5g'

const getPatchArray = patch => {
  let smallPatch = patch.split('\n')
  let result = []
  let counter = 0
  let currentString = ''
  for (let i = 0; i < smallPatch.length; i++) {
    if (counter + smallPatch[i].length + 1 <= 400) {
      currentString += smallPatch[i] + ' '
      counter += smallPatch[i].length + 1
    } else {
      result.push(currentString)
      currentString = smallPatch[i] + ' '
      counter = smallPatch[i].length + 1
    }
  }
  result.push(currentString)
  return result
}

const getPullRequest = async () => {
  const PrLink = core.getInput('pr-link')
  const githubToken = core.getInput('token')
  const octokit = github.getOctokit(githubToken)
  const { data: pullRequest } = await octokit.rest.pulls.get({
    owner: 'akshay-rao-h2',
    repo: 'test-github-actions',
    pull_number: PrLink,
    mediaType: {
      format: 'diff'
    }
  })
  return getPatchArray(pullRequest)
}

const getAccessToken = async () => {
  return chatToken
}

async function* streamAsyncIterable (stream) {
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

async function fetchSSE (resource, options) {
  const { onMessage, ...fetchOptions } = options
  const resp = await fetch(resource, fetchOptions)
  if (resp.status > 399) {
    resp.json().then(r => {
      inProgress(false, true)
      onMessage(JSON.stringify({ message: { content: { parts: [r.detail] } } }))
    })
    return
  }
  const parser = createParser(event => {
    if (event.type === 'event') {
      onMessage(event.data)
    }
  })
  for await (const chunk of streamAsyncIterable(resp.body)) {
    const str = new TextDecoder().decode(chunk)
    parser.feed(str)
  }
}

async function callChatGPT (question, callback= ()=>{}, onDone = ()=>{}) {
  const accessToken = await getAccessToken()
  await fetchSSE('https://chat.openai.com/backend-api/conversation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      action: 'next',
      messages: [
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: {
            content_type: 'text',
            parts: [question]
          }
        }
      ],
      model: 'text-davinci-002-render',
      parent_message_id: crypto.randomUUID()
    }),
    onMessage (message) {
      if (message === '[DONE]') {
        onDone()
        return
      }
      const data = JSON.parse(message)
      const text = data.message?.content?.parts?.[0]
      if (text) {
        callback(text)
      }
    }
  })
}

async function reviewPR () {
  const patchArray = await getPullRequest()
  let PRReviewResult = ''
  let result = ''
  patchArray.forEach((item, index) => {
    let prompt = `
    Act as a code reviewer of a Pull Request, providing feedback on the code changes below. The code is in form of chunks please keep the context of previous chunk in mind.
    You are provided with the Pull Request changes in a patch format.
    Each patch entry has the commit message in the Subject line followed by the code changes (diffs) in a unidiff format.
    \n\n
    Patch of the Pull Request to review:
    \n
    ${item}
    \n\n
    
    As a code reviewer, your task is:
    - Review the code changes (diffs) in the patch and provide feedback.
    - If there are any bugs, highlight them.
    - Does the code do what it says in the commit messages?
    - Do not highlight minor issues and nitpicks.
    - Use bullet points if you have multiple comments.
    - Limit comments to 3 per chunk`
    if (index === patchArray.length - 1) {
      callChatGPT(
        prompt,
        answer => {
          result = converter.makeHtml(answer)
          // console.log(result)
        },
        () => {
          PRReviewResult += '\n' + result
          console.log(PRReviewResult)
        }
      )
    } else {
      callChatGPT(
        prompt,
        answer => {
          result = converter.makeHtml(answer)
          // console.log(result)
        },
        () => {
          PRReviewResult += '\n' + result
        }
      )
    }
  })
}

reviewPR()
