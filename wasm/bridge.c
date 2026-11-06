/* Zihatec wrapper around original rscada/libmbus, BSD-3-Clause.
 * Input: a complete wired M-Bus long frame (checksum checked by libmbus).
 * Output: UTF-8 XML, owned by this module until the next call.
 */
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include "mbus-protocol.h"

static char *result = NULL;
static const char *failure(const char *reason) { return reason; }

/* libmbus generates ISO-8859-1 XML. Emscripten's ccall('string') assumes
 * UTF-8: transcode bytes without depending on browser or locale APIs. */
static char *latin1_to_utf8(const unsigned char *src) {
    size_t n = strlen((const char *)src);
    if (n > (SIZE_MAX - 1) / 2) return NULL;
    char *dst = malloc(n * 2 + 1);
    if (!dst) return NULL;
    size_t i=0,j=0;
    while (i<n) {
        unsigned char c=src[i++];
        if(c<128) dst[j++]=(char)c;
        else { dst[j++]=(char)(0xC0 | (c>>6)); dst[j++]=(char)(0x80 | (c&0x3F)); }
    }
    dst[j]=0;
    return dst;
}

const char *zihatec_mbus_xml(const unsigned char *buf, int len) {
    free(result); result=NULL;
    if(!buf || len<9 || len>261) return failure("ERROR:invalid length");
    /* Explicit frame length check limits parsing untrusted bytes. */
    if(buf[0]!=0x68 || buf[3]!=0x68 || buf[1]!=buf[2] ||
       len!=(int)buf[1]+6 || buf[len-1]!=0x16)
        return failure("ERROR:invalid long frame envelope");
    mbus_frame frame; memset(&frame,0,sizeof(frame));
    int ret=mbus_parse(&frame,(unsigned char *)buf,(size_t)len);
    if(ret!=0) return failure("ERROR:libmbus frame parse failed");
    if(mbus_frame_verify(&frame)!=0) return failure("ERROR:invalid checksum/frame");
    char *xml=mbus_frame_xml(&frame);
    if(!xml) return failure("ERROR:libmbus data decode failed");
    result=latin1_to_utf8((const unsigned char *)xml);
    free(xml);
    return result ? result : failure("ERROR:out of memory");
}
