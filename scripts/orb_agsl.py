"""Turn the bubble's WebGL shader (static/orb.js) into AGSL for Android's RuntimeShader.

One source of truth: the web bubble and the native overlay bubble share the same material
code. The GLSL in orb.js is written so that a few textual substitutions are enough.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def glsl_source(path=ROOT / 'static' / 'orb.js'):
    text = path.read_text(encoding='utf-8')
    match = re.search(r'const FRAGMENT = `(.*?)`;', text, re.S)
    if not match:
        raise RuntimeError('Shader de la bulle introuvable dans static/orb.js.')
    return match.group(1)


def to_agsl(glsl):
    code = re.sub(r'^precision [^;]+;\s*', '', glsl.strip())
    code = re.sub(r'\bvec2\b', 'float2', code)
    code = re.sub(r'\bvec3\b', 'float3', code)
    code = re.sub(r'\bmat2\b', 'float2x2', code)
    # AGSL's origin is the top-left corner: flip y so the light comes from the same side.
    code = code.replace('void main(){', 'half4 main(float2 fragCoord){', 1)
    code = code.replace('gl_FragCoord.xy', 'float2(fragCoord.x,uRes.y-fragCoord.y)')
    code = re.sub(r'gl_FragColor=vec4\((\w+),(\w+)\);', r'return half4(half3(\1),half(\2));', code)
    leftovers = re.findall(r'\b(?:vec4|gl_\w+|precision)\b', code)
    if leftovers or 'half4 main(' not in code or 'return half4(' not in code:
        raise RuntimeError('Conversion AGSL incomplète : ' + ', '.join(sorted(set(leftovers))))
    return code + '\n'


def write(target):
    target.write_text(to_agsl(glsl_source()), encoding='utf-8')


if __name__ == '__main__':
    print(to_agsl(glsl_source()))
