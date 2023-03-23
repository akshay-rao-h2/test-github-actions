const core = require('@actions/core')
const github = require('@actions/github')
const { v4: uuidv4 } = require('uuid')
const Cryptr = require('cryptr');
const cryptr = new Cryptr('myTotallySecretKey');
// console.log(cryptr.encrypt('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'))


const AITOKEN = core.getInput('AITOKEN') || '4c9f4c19aad680e80a27a665733a053b1a81324808fef83019b54eab5911f10634150143834830d1107d46293d6affd0d879e697f7e1227622b2b18a3904c8d8b800df7843de118483e5bcfab973b2572b1f2859c6bf6de45a6ade456b9f308734796925c3c3b2246f56e6658d0f034852930310df3f5cdb21982c825e1a346fe7d80a2f0a62e7c018b353e72f4e2b2e5c8536'

const commitId = core.getInput('commit-id') || '89830c298f0bfcc97ad27ec4fb004af15248b9f4'
const repo = core.getInput('repo') || 'akshay-rao-h2/test-github-actions'
const PrLink = core.getInput('pr-link') || 3

const tokens = cryptr.decrypt(AITOKEN);
const chatToken = tokens
// console.log(chatToken)
const githubToken = core.getInput('token') 
const octokit = github.getOctokit(githubToken)


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

const postComment = async (body = 'Great stuff!') => {
  // console.log(`/repos/${repo}/issues/${PrLink}/comments`)
  // return true
  await octokit.request(`POST /repos/${repo}/issues/${PrLink}/comments`, {
    owner: 'akshay-rao-h2',
    repo: 'test-github-actions',
    issue_number: PrLink,
    body,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
}

const getPullRequest = async () => {
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


async function callChatGPT (question, callback = () => {}, onDone = () => {}) {
  try {
    const resp = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{role: 'user', content: question}]
    })
    console.log(JSON.stringify(resp.data.choices[0].message))
    return resp.data.choices[0].message.content[0].message
    // callback(resp.data.choices[0].text)
  } catch (e) {
    console.log({e})
  }
}
let PRReviewResult = ''

const getComments = async patchItem => {
  let prompt = `
  Act as a code reviewer of a Pull Request, providing feedback on the code changes below. The code is in form of chunks please keep the context of previous chunk in mind.
  You are provided with the Pull Request changes in a patch format.
  Each patch entry has the commit message in the Subject line followed by the code changes (diffs) in a unidiff format.
  \n\n
  Patch of the Pull Request to review:
  \n
  ${patchItem}
  \n\n
  
  As a code reviewer, your task is:
  - Review the code changes (diffs) in the patch and provide feedback.
  - If there are any bugs, highlight them.
  - Do not highlight minor issues and nitpicks.
  - Limit comments to 1 point maximum and please answer in atmax 25 words.
  - do not add unnecessary new lines.
  - please give only issues that you see.
  - return in markup language for github`

  const result = await callChatGPT(prompt)
  PRReviewResult += '\n' + result
  return PRReviewResult
}
async function reviewPR () {
  const patchArray = await getPullRequest()
  let result = ''
  for (let i = 0; i < patchArray.length; i++) {
    console.log(patchArray[i])
    await getComments(patchArray[i])
  }
  console.log(PRReviewResult)

  postComment(PRReviewResult)
}

reviewPR()
