/** Test-only guard: every numeric edition directory in the pinned base is immutable. */
import {execFileSync} from 'node:child_process';

export function protectedEditionChanges({cwd,base}) {
  if (typeof cwd!=='string'||!cwd||typeof base!=='string'||!base.trim()) {
    throw new TypeError('History guard requires a repository directory and pinned base');
  }
  const git=args=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
  let commit,directories;
  try {
    commit=git(['rev-parse','--verify','--end-of-options',base+'^{commit}']).trim();
    const tree=git(['rev-parse','--verify','--end-of-options',commit+':uk_renewables_pipeline']).trim();
    if (git(['cat-file','-t',tree]).trim()!=='tree') throw new Error('Pipeline baseline is not a directory');
    directories=git(['ls-tree','-d','--name-only','-z',tree]).split('\0')
      .filter(name=>/^\d{12}$/.test(name)).map(name=>'uk_renewables_pipeline/'+name);
    if (!directories.length) throw new Error('Pipeline baseline has no numeric edition directories');
  } catch (cause) {
    throw new Error('Cannot resolve immutable edition history from pinned base '+base,{cause});
  }
  // Check both the working tree and index: an unstaged restoration must not hide
  // a staged mutation. No rename detection means the original deletion is kept.
  const changed=new Set([
    ...git(['diff','--name-only','--no-renames','-z',commit,'--']).split('\0'),
    ...git(['diff','--cached','--name-only','--no-renames','-z',commit,'--']).split('\0'),
    ...git(['ls-files','--others','--exclude-standard','-z']).split('\0')
  ].filter(Boolean));
  return [...changed].filter(path=>directories.some(dir=>path===dir||path.startsWith(dir+'/'))).sort();
}
