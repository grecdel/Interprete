import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import orb_agsl  # noqa: E402


class OrbShaderTests(unittest.TestCase):
    """The Android overlay bubble is generated from the web bubble's shader."""

    def test_agsl_conversion_is_complete(self):
        code = orb_agsl.to_agsl(orb_agsl.glsl_source())
        self.assertIn('half4 main(float2 fragCoord){', code)
        self.assertIn('return half4(half3(outc),half(alpha));', code)
        self.assertNotRegex(code, r'\b(vec[234]|mat2|gl_\w+|precision)\b')
        for uniform in ('uRes', 'uTime', 'uAmp', 'uEnergy', 'uAlert', 'uSeed', 'uLife', 'uMat', 'uLight', 'uMid', 'uHot', 'uBase'):
            self.assertRegex(code, r'uniform [^;]*\b' + uniform + r'\b')

    def test_shader_avoids_names_and_literals_agsl_rejects(self):
        glsl = orb_agsl.glsl_source()
        self.assertNotRegex(glsl, r'\b(hash|noise)\(')  # Reserved or ambiguous in shading languages.
        self.assertNotRegex(glsl, r'vec[23]\((\d,)+\d\)')  # Integer constructor arguments.


if __name__ == '__main__':
    unittest.main()
