import * as FSE from 'fs-extra'
import * as path from 'path'
import { Repository } from '../../../src/models/repository'
import { setupEmptyRepository } from '../../helpers/repositories'
import { GitProcess } from 'dugite'
import {
  getDesktopStashEntries,
  createStashMessage,
  createStashEntry,
  getLastStashEntry,
} from '../../../src/lib/git/stash'

describe('git/stash', () => {
  describe('getDesktopStashEntries', () => {
    let repository: Repository
    let readme: string

    beforeEach(async () => {
      repository = await setupEmptyRepository()
      readme = path.join(repository.path, 'README.md')
      await FSE.writeFile(readme, '')
      await GitProcess.exec(['add', 'README.md'], repository.path)
      await GitProcess.exec(['commit', '-m', 'initial commit'], repository.path)
    })

    it.only('handles unborn repo by returning empty list', async () => {
      const repo = await setupEmptyRepository()
      readme = path.join(repo.path, 'README.md')
      await FSE.writeFile(readme, '')
      await stash(repo, 'master', null)

      expect(getDesktopStashEntries(repo)).rejects.toThrow()
    })

    it('returns all stash entries created by Desktop', async () => {
      await generateTestStashEntry(repository, 'master', false)
      await generateTestStashEntry(repository, 'master', false)
      await generateTestStashEntry(repository, 'master', true)

      const stashEntries = await getDesktopStashEntries(repository)

      expect(stashEntries).toHaveLength(1)
      expect(stashEntries[0].branchName).toBe('master')
    })
  })

  describe('createStashEntry', () => {
    let repository: Repository
    let readme: string

    beforeEach(async () => {
      repository = await setupEmptyRepository()
      readme = path.join(repository.path, 'README.md')
      await FSE.writeFile(readme, '')
      await GitProcess.exec(['add', 'README.md'], repository.path)
      await GitProcess.exec(['commit', '-m', 'initial commit'], repository.path)
    })

    it('creates a stash entry', async () => {
      await await FSE.appendFile(readme, 'just testing stuff')
      const tipSha = await getTipSha(repository)

      await createStashEntry(repository, 'master', tipSha)

      const result = await GitProcess.exec(['stash', 'list'], repository.path)
      const entries = result.stdout.trim().split('\n')
      expect(entries).toHaveLength(1)
    })
  })

  describe('getLastStashEntry', () => {
    let repository: Repository
    let readme: string

    beforeEach(async () => {
      repository = await setupEmptyRepository()
      readme = path.join(repository.path, 'README.md')
      await FSE.writeFile(readme, '')
      await GitProcess.exec(['add', 'README.md'], repository.path)
      await GitProcess.exec(['commit', '-m', 'initial commit'], repository.path)
    })

    it('returns null when no stash entries exist for branch', async () => {
      await generateTestStashEntry(repository, 'some-other-branch', true)

      const entry = await getLastStashEntry(repository, 'master')

      expect(entry).toBeNull()
    })

    it('returns last entry made for branch', async () => {
      const branchName = 'master'
      await generateTestStashEntry(repository, branchName, true)
      const lastEntry = await generateTestStashEntry(
        repository,
        branchName,
        true
      )

      const actual = await getLastStashEntry(repository, branchName)

      expect(actual!.stashSha).toBe(lastEntry)
    })
  })
})

async function getTipSha(repository: Repository) {
  const result = await GitProcess.exec(['rev-parse', 'HEAD'], repository.path)
  return result.stdout.trim()
}

async function stash(
  repository: Repository,
  branchName: string,
  message: string | null
): Promise<string> {
  const tipSha = await getTipSha(repository)
  const result = await GitProcess.exec(['stash', 'create'], repository.path)
  const objectId = result.stdout.trim()
  await GitProcess.exec(
    [
      'stash',
      'store',
      '-m',
      message || createStashMessage(branchName, tipSha),
      objectId,
    ],
    repository.path
  )

  return objectId
}

async function generateTestStashEntry(
  repository: Repository,
  branchName: string,
  createdByDesktop: boolean
): Promise<string> {
  const message = createdByDesktop ? null : 'Should get filtered'
  const readme = path.join(repository.path, 'README.md')
  await FSE.appendFile(readme, '1')
  const objectId = await stash(repository, branchName, message)

  return objectId
}
