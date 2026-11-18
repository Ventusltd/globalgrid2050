"""Create a disposable integrated preview without reserving/editing an edition."""
from pathlib import Path
import argparse,base64,hashlib,io,json,re,shutil,subprocess,zipfile


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-ref',required=True)
    parser.add_argument('--edition',required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--journey-ref',help='Optional exact sender commit, copied for explicit async fixture loading')
    parser.add_argument('--news-hook',action='store_true',help='Preview the new-edition-only current-view getter')
    args=parser.parse_args()
    if not re.fullmatch('[a-f0-9]{40}',args.source_ref) or not re.fullmatch('[0-9]{12}',args.edition):
        raise SystemExit('Exact source commit and dated edition required')
    if args.journey_ref and not re.fullmatch('[a-f0-9]{40}',args.journey_ref):
        raise SystemExit('Exact Journey sender commit required')
    root=Path(__file__).resolve().parents[3]
    output=args.output.resolve()
    if output.exists() or output==root or root in output.parents:
        raise SystemExit('Use a new disposable output outside the source worktree')
    source_index=subprocess.check_output(['git','-C',str(root),'show',f'{args.source_ref}:uk_renewables_pipeline/{args.edition}/index.html'])
    references=re.findall(r'(?:src|href)="\.\./\.\./(automation/[^"?]+)',source_index.decode('utf-8'))
    shared=sorted({str(Path(value).parent).replace('\\','/') for value in references})
    # Existing dynamic imports/data consumers are outside direct HTML tags.
    # Reuse their committed closure; never replace a missing input with a mock.
    shared+=['automation/primary_note_ui','automation/news/grid_watch/sources.json',
             'uk_renewables_pipeline/202611161747/global-datacentres/projects.json',
             'dist/major_project_news_v9_5_1.json']
    archive=subprocess.check_output(['git','-C',str(root),'archive','--format=zip',args.source_ref,f'uk_renewables_pipeline/{args.edition}',*shared],timeout=90)
    if len(archive)>100_000_000:
        raise SystemExit('Archive bound exceeded')
    with zipfile.ZipFile(io.BytesIO(archive)) as files:
        if sum(item.file_size for item in files.infolist())>200_000_000:
            raise SystemExit('Expanded preview bound exceeded')
        for item in files.infolist():
            if not (output/item.filename).resolve().is_relative_to(output):
                raise SystemExit('Unsafe archive path')
        output.mkdir(parents=True)
        files.extractall(output)
    if args.journey_ref:
        sender=subprocess.check_output(['git','-C',str(root),'archive','--format=zip',args.journey_ref,'automation/journey_entry_ui/20261118'],timeout=30)
        with zipfile.ZipFile(io.BytesIO(sender)) as files:
            for item in files.infolist():
                if not (output/item.filename).resolve().is_relative_to(output):
                    raise SystemExit('Unsafe sender archive path')
            files.extractall(output)
    module=Path(__file__).resolve().parent
    target=output/'automation/energy_context_ui/20261118'
    shutil.copytree(module,target,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    index=output/f'uk_renewables_pipeline/{args.edition}/index.html'
    original=index.read_bytes()
    if original!=source_index:
        raise SystemExit('Archive index differs from committed source')
    styles=base64.b64encode(hashlib.sha256((module/'styles.css').read_bytes()).digest()).decode()
    script=base64.b64encode(hashlib.sha256((module/'view.mjs').read_bytes()).digest()).decode()
    tags=f'<link rel="stylesheet" href="../../automation/energy_context_ui/20261118/styles.css" integrity="sha256-{styles}">\n<script type="module" src="../../automation/energy_context_ui/20261118/view.mjs" integrity="sha256-{script}"></script>\n'
    text=original.decode('utf-8')
    if text.count('</body>')!=1 or 'energy_context_ui/20261118/view.mjs' in text:
        raise SystemExit('Unexpected predecessor context inclusion')
    index.write_text(text.replace('</body>',tags+'</body>'),encoding='utf-8',newline='\n')
    hook_delta=0
    if args.news_hook:
        renderer=output/f'uk_renewables_pipeline/{args.edition}/scripts/plugins/live-news.js'
        before=renderer.read_bytes();code=before.decode('utf-8');needle='attachView: function(adapter)'
        if code.count(needle)!=1:raise SystemExit('Unexpected existing news adapter API')
        renderer.write_text(code.replace(needle,'getViewAdapter:function(){return qualityAdapter;},'+needle),encoding='utf-8',newline='\n');hook_delta=renderer.stat().st_size-len(before)
    receipt={'scope':'LOCAL_REVERSIBLE_PREVIEW_ONLY','source_ref':args.source_ref,'edition':args.edition,'original_index_sha256':hashlib.sha256(original).hexdigest(),'index_bytes_before':len(original),'index_bytes_after':index.stat().st_size,'edition_bytes_delta':index.stat().st_size-len(original),'style_sha256':hashlib.sha256((module/'styles.css').read_bytes()).hexdigest(),'module_sha256':hashlib.sha256((module/'view.mjs').read_bytes()).hexdigest(),'new_version_reserved':False,'public_acceptance':False}
    receipt['journey_sender_ref']=args.journey_ref
    receipt['news_hook_bytes']=hook_delta
    receipt['total_edition_bytes_delta']=receipt['edition_bytes_delta']+hook_delta
    (output/'preview-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt,indent=2))


if __name__=='__main__':main()
