const core = require('@actions/core')
const github = require('@actions/github')
const { v4: uuidv4 } = require('uuid')

const chatToken = core.getInput('AITOKEN') || core.getInput('AiToken') || core.getInput('aitoken')

const { Configuration, OpenAIApi } = require('openai')

const configuration = new Configuration({
  apiKey: chatToken
})
const openai = new OpenAIApi(configuration)

// const fetch = require('node-fetch');

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
  const PrLink = core.getInput('pr-link') || 2
  const githubToken =
    core.getInput('token') || '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'

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
  try {
    const { onMessage, ...fetchOptions } = options
    // console.log({ fetchOptions })
  
    console.log(JSON.stringify({ data: resp }))
    // if (resp.status > 399) {
    //   console.log(resp)
    //   resp
    //     .json()
    //     .then(r => {
    //       inProgress(false, true)
    //       // onMessage(JSON.stringify({ message: { content: { parts: [r.detail] } } }))
    //     })
    //     .catch(e => {})
    //   return
    // }
    // const parser = createParser(event => {
    //   if (event.type === 'event') {
    //     onMessage(event.data)
    //   }
    // })
    // for await (const chunk of streamAsyncIterable(resp.body)) {
    //   const str = new TextDecoder().decode(chunk)
    //   parser.feed(str)
    // }
  } catch (e) {}
}

async function callChatGPT (question, callback = () => {}, onDone = () => {}) {
  const accessToken = await getAccessToken()
  const resp = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: question
  })
  console.log(resp.data.choices[0].text);
  // await fetchSSE('https://chat.openai.com/backend-api/conversation', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     Authorization: `Bearer ${accessToken}`
  //   },
  //   body: JSON.stringify({
  //     action: 'next',
  //     messages: [
  //       {
  //         id: uuidv4(),
  //         role: 'user',
  //         content: {
  //           content_type: 'text',
  //           parts: []
  //         }
  //       }
  //     ],
  //     model: 'text-davinci-002-render',
  //     parent_message_id: uuidv4()
  //   }),
  //   onMessage (message) {
  //     if (message === '[DONE]') {
  //       onDone()
  //       return
  //     }
  //     const data = JSON.parse(message)
  //     const text = data.message?.content?.parts?.[0]
  //     if (text) {
  //       callback(text)
  //     }
  //   }
  // })
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
          // console.log(PRReviewResult)
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
