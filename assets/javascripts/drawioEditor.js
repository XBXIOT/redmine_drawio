// The container for global settings
if(!Drawio)
    Drawio = {};

// Container for localized strings
Drawio.strings = {};

/**
 * Handles editing of a diagram.
 * @param image DOM element of the diagram image
 * @param resource The filename of the diagram (with extension)
 * @param isDmsf true if the diagram is stored with the DMSF module
 * @param pageName The wiki page name (if the document is a wiki page)
 */
function editDiagram(image, resource, isDmsf, pageName, originalName) {
    /**
     * Convert a DOM element to a String.<br/>
     * This method is necessary because of the {@code content} attribute of the SVG tag, which is an XML.
     * Converting the xmlDom directly to string will produce a representation which is not well formed.
     * @param xmlDom DOM element to convert.
     * @return xmlDom serialized as String.
     */
    function getXmlAsString(xmlDom){
        return (typeof XMLSerializer !== 'undefined')?
            (new window.XMLSerializer()).serializeToString(xmlDom) :
            xmlDom.xml;
    }

    function getInitialSvgData(image) {
        if(image.nodeName.toLowerCase() === 'svg') {
            // plain svg
            return getXmlAsString(image).replace(/"=""/, ''); // Fix for corrupted SVG after save without reloading page
        } else {
            // base64 encoded svg
            return atob(image.getAttribute('src').substring(('data:'+imageType+';base64,').length));
        }
    }

    function extractData(data, type) {
        return Base64Binary.decodeArrayBuffer(data.substring(('data:'+type+';base64,').length));
    }

    function makeResizable(svg) {
        return svg.replace(/<svg (.*) width="([0-9]+)px" height="([0-9]+)px viewBox"(.*)"/,
                           '<svg preserve_aspect_ratio="xMaxYMax meet" style="max-width:100%" width="$2px" height="$3px" viewBox="0 0 $2 $3" $1');
    }

    function getLang() {
        if(navigator.languages) {
            return navigator.languages[0];
        }
        return navigator.language;
    }

    var pngMime   = 'image/png';
    var svgMime   = 'image/svg+xml';
    var xmlMime   = 'application/xml';
    var imageType = (resource.match(/\.svg$/i)? svgMime: (resource.match(/\.png$/i)? pngMime: xmlMime));
    var isSvg     = imageType === svgMime;
    var isPng     = imageType === pngMime;
    var imgDescriptor;
    var iframe = document.createElement('iframe');

    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('class', 'drawioEditor');

    if(isSvg)
        imgDescriptor = {
            fmt: "xmlsvg",
            mimeType: svgMime,
            ext: 'svg',
            initial: getInitialSvgData(image),
            //atob(image.getAttribute('src').substring(('data:'+imageType+';base64,').length)),
            extractImageData: function(rawImage) {
                // FIXME: decode base64 svg
                var data = extractData(rawImage, imgDescriptor.mimeType);
                var stringData = Base64Binary.arrayBufferToString(data);

                if(stringData.charCodeAt(stringData.length-1) === 0) {
                    stringData = stringData.substring(0, stringData.length-1);
                }
                if(stringData.charCodeAt(stringData.length-1) === 0) {
                    stringData = stringData.substring(0, stringData.length-1);
                }
                // It seems that the SVG image coming from Drawio is not correctly encoded (or decoded)
                if(stringData.endsWith("</sv")) {
                    stringData += "g>";
                }
                else if(stringData.endsWith("</svg")) {
                    stringData += ">";
                }

                return stringData;
            },
            showLoader: function() {
                $(image).hide();
                $(image.parentElement).prepend('<img id="drawioLoader" src="'+Drawio.settings.drawioUrl.split('?')[0]+'/images/ajax-loader.gif"/>');
            },
            hideLoader: function(initial) {
                $("#drawioLoader").remove();
                $(image).show();
            },
            updateImage: function(rawImage) {
                var svgImage = imgDescriptor.extractImageData(rawImage);

                if(image.nodeName.toLowerCase() === 'svg') {
                    // plain svg
                    $(image.parentNode).html(makeResizable(svgImage));
                } else {
                    // svg base64 encoded
                    var base64Svg = "data:image/svg+xml;base64," + Base64Binary.encode(makeResizable(svgImage));
                    $(image).attr('src', base64Svg);
                }
            },
            launchEditor: function(initial) {
                iframe.contentWindow.postMessage(JSON.stringify({action: 'load', xml: initial}), '*');
            },
            save: function(msg) {
                iframe.contentWindow.postMessage(JSON.stringify({action: 'export', format: "xmlsvg", spin: Drawio.strings['drawio_updating_page']}), '*');
            }
        };
    else if(isPng)
        imgDescriptor = {
            fmt: "xmlpng",
            mimeType: pngMime,
            ext: 'png',
            initial: image.getAttribute('src'),
            extractImageData: function(rawImage) {
                return extractData(rawImage, imgDescriptor.mimeType)
            },
            showLoader: function() {
                image.setAttribute('src', Drawio.settings.drawioUrl.split('?')[0]+'/images/ajax-loader.gif');
            },
            hideLoader: function(initial) {
                image.setAttribute('src', initial);
            },
            updateImage: function(rawImage) {
                image.setAttribute('src', rawImage);
                imgDescriptor.initial = rawImage; // so the hideLoader() in the close() will not revert the image
            },
            launchEditor: function(initial) {
                iframe.contentWindow.postMessage(JSON.stringify({action: 'load', xmlpng: initial}), '*');
            },
            save: function(msg) {
                iframe.contentWindow.postMessage(JSON.stringify({action: 'export', format: "xmlpng", spin: Drawio.strings['drawio_updating_page']}), '*');
            }
        };
    else
        imgDescriptor = {
            fmt: 'xml',
            mimeType: xmlMime,
            ext: 'xml',
            initial: $.parseJSON($(image).attr('data-mxgraph')).xml,
            extractImageData: function(rawImage) {
                return rawImage;
            },
            showLoader: function() {
                $(image).html('<img id="drawioLoader" src="'+Drawio.settings.drawioUrl.split('?')[0]+'/images/ajax-loader.gif"/>');
            },
            hideLoader: function(initial) {
                // Destroy div contents and redraw the diagram
                $(image).html("");
                GraphViewer.createViewerForElement(image[0]);
            },
            updateImage: function(rawImage) {
                var newValue = $.parseJSON($(image).attr('data-mxgraph'));
                newValue.xml = rawImage;
                $(image).attr('data-mxgraph', JSON.stringify(newValue));
            },
            launchEditor: function(initial) {
                iframe.contentWindow.postMessage(JSON.stringify({action: 'load', xml: initial}), '*');
            },
            save: function(msg) {
                save(msg.xml);
            }
        };

    imgDescriptor.showLoader();

    function close() {
        imgDescriptor.hideLoader(imgDescriptor.initial);
        document.body.removeChild(iframe);
        document.body.style.position = 'static';
        document.body.style.width = 'auto';        
        window.removeEventListener('message', receive);
        window.removeEventListener('resize', adjustIframeSize);
    };

    function receive(evt) {
        if (evt.data.length > 0 && evt.source == iframe.contentWindow) {
            // https://www.drawio.com/doc/faq/embed-mode
            var msg = JSON.parse(evt.data);

            switch(msg.event) {
                case 'init':
                    imgDescriptor.launchEditor(imgDescriptor.initial);
                    break;
                case 'export':
                    save(msg.data);
                    break;
                case 'save':
                    if(!(msg.bounds.width && msg.bounds.height)) {
                        // The diagram is empty. If it were saved, there would be no image
                        // on the page to click to be able to modify the diagram.
                        // So we ask the user to choose to stay in the editor or to leave and
                        // use the default image placeholder.
                        if(msg.currentPage > 0) {
                            alert(Drawio.strings['drawio_empty_diag_page']);
                        }
                        else {
                            alert(Drawio.strings['drawio_empty_diag']);
                        }
                        break;
                    }
                    imgDescriptor.save(msg);
                    break;
                case 'exit':
                    close();
                    break;
            }
        }
    };

    // Define the configuration options in an object
    var config = {
        embed: '1',
        ui: Drawio.settings.drawioUi,
        spin: '1',
        modified: 'unsavedChanges',
        libraries: '1',
        proto: 'json',
        lang: Drawio.settings.lang
    };

    var iframeUrl = Drawio.settings.drawioUrl;
    
    // Disables SSL if the protocol isn't HTTPS; simplifies use of local drawio installations
    var useHttps  = (iframeUrl.match(/^(https:)?\/\//i)? 1: 0);

    // Convert the config object into a query string
    var options = Object.keys(config)
        .map(key => `${key}=${config[key]}`)
        .join('&') + '&https=' + useHttps;

    if(iframeUrl.indexOf('?') > 0) {
        iframeUrl += '&'+options;
    } else {
        iframeUrl += '?'+options;
    }

    window.addEventListener('message', receive);

    // Set initial size
    adjustIframeSize();

    // Add event listener for window resize
    window.addEventListener('resize', adjustIframeSize);


    // Function to adjust iframe size
    function adjustIframeSize() {
        var topMenuHeight = document.getElementById('top-menu').offsetHeight;
        var iframe = document.querySelector('iframe'); // Make sure this selector matches your iframe

        if (iframe) {
            iframe.style.top = topMenuHeight + 'px';
            var mainHeight = window.innerHeight - topMenuHeight;
            iframe.style.height = mainHeight + 'px';
        }
    }

    // Get the height of the top menu
    var topMenuHeight = document.getElementById('top-menu').offsetHeight;
    // Set the top position of the iframe
    iframe.style.top = topMenuHeight + 'px';
    // Set the height of the iframe to fill remaining space
    var mainHeight = window.innerHeight - topMenuHeight;
    iframe.style.height = mainHeight + 'px';
    iframe.setAttribute('src', iframeUrl);
    document.body.appendChild(iframe);

    // Fix the body to prevent scrolling
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    /**
     * Show an alert if case of error saving the diagram.
     */
    function showError(jqXHR, textStatus, errorThrown) {
        var msg;

        if(jqXHR.responseJSON && jqXHR.responseJSON.errors)
            msg = jqXHR.responseJSON.errors.join(', ');
        else
            switch(jqXHR.status) {
                case 401: msg = Drawio.strings['drawio_http_401']; break;
                case 404:
                    if(isDmsf)
                        msg = Drawio.strings['drawio_http_404'];
                    else
                        msg = Drawio.strings['drawio_save_error'];
                    break;
                case 409: msg = Drawio.strings['drawio_http_409']; break;
                case 422: msg = Drawio.strings['drawio_http_422']; break;
                case 502: msg = Drawio.strings['drawio_http_502']; break;
                default:  msg = errorThrown;
            }

            alert(Drawio.strings['drawio_error_saving' ]+msg);
    }

    function getHash() {
        return Base64Binary.arrayBufferToString(Base64Binary.decodeArrayBuffer(Drawio.settings.hashCode.split('').reverse().join(''))).replace(/\u0000/g,'');
    }

    /**
     * Save the image data as attachment or in DMSF.<br/>
     * The image will also be updated in the page, without reloading.
     * @param data Image data url (content of the {@code src} attribute).
     */
    function save(data) {
        // Diagram is not empty
        var imageData = imgDescriptor.extractImageData(data);

        imgDescriptor.updateImage(data);
        close();

        if(isDmsf) {
            saveDmsf(Drawio.settings.redmineUrl+'dmsf/webdav/'+resource, imageData, imageType);
        }
        else {
            saveAttachment(resource , imageData, imageType, pageName);
        }
    }

    /**
     * Saves the data as an DMSF document througth the WebDAV functionality.
     * If the document is missing, it will be created; if exists, a new
     * version will be created.
     * @param url URL of the DMSF document.
     * @param imageData Data of the attachment.
     * @param type Type of the image ({@code png} or {@code svg+xml})
     */
    function saveDmsf(url, imageData, type) {
        if(url) {
            $.ajax({
                url        : url,
                type       : 'PUT',
                dataType   : 'text',
                mimeType   : 'text/plain', // Fixes a "non well-formed" message in the Firefox console
                processData: false,
                contentType: type,
                data       : imageData,
                error      : showError
            });
        }
    }

    // Request for delete attachments in Redmine: http://www.redmine.org/issues/14828
    /**
     * Saves the data as an attachment of the wiki page.
     * @param resource Address of the wiki page.
     * @param imageData Data of the attachment.
     * @param type Type of the image ({@code png} or {@svg+xml}).
     */
    function saveAttachment(resource, imageData, type, pageName) {
        var pageUrl = window.location.pathname;
        var encodedPageName = new RegExp('/wiki/'+encodeURI(pageName).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')+'$', 'i');

        // pageName !== "" means it's a wiki page
        if(pageName !== "" && !pageUrl.match(encodedPageName))
            pageUrl += '/'+pageName; // Fix main wiki page url

        function readWikiPage(uploadResponse) {
            // This is the token to reference the uploaded attachment
            var token = uploadResponse.upload.token;

            /**
             * Save the wiki page as text (unmodified) plus the reference to the attachment
             * @param page JSON description of the wiki page
             */
            function savePage(page) {
                function escapeRegExp(string) {
                    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
                }

                function updateDiagramReference(pageBody) {
                    // Build a pattern like attachName(_\d+)?\.*
                    var resourcePattern = escapeRegExp(resource).replace(/^(.*?)(_\d+)?(\\\.\w+)?$/, function(m,p1,p2,p3) {
                        return p1.replace(/_/g, '.')+'(_\\d+)?('+p3+')?';
                    })
                    // Build pattern to match the drawio_attach macro with resource pattern
                    var macroRegExp = escapeRegExp('{{drawio_attach(')+resourcePattern+'(\\s*,.*)?'+escapeRegExp(')}}');
                    // Replace old attachment name with the new name
                    return pageBody.replace(new RegExp(macroRegExp), '{{drawio_attach('+resource+'$3)}}');
                }

                function referencesDiagram(body) {
                    if (body == null || typeof body == 'undefined') body = "";

                    // Build a pattern like attachName(_\d+)?\.*
                    var resourcePattern = escapeRegExp(resource).replace(/(_\d+)?(\\\.\w+)?$/, '(_\\d+)?($2)?')
                    // Build pattern to match the drawio_attach macro with resource pattern
                    var macroRegExp = escapeRegExp('{{drawio_attach(')+resourcePattern+'(\\s*,.*)?'+escapeRegExp(')}}');

                    return body.match(new RegExp(macroRegExp));
                }

                /**
                 * Updates the list of attachments without reloading the page.
                 * Since some text is language dependente, we get the last attachment in the page
                 * and replace the the infos with those from the new attachment.
                 */
                function updateAttachmentList() {
                    // Re-read the page to retrieve the list of attachments
                    $.ajax({
                        url     : pageUrl+'.json',
                        type    : 'GET',
                        dataType: 'json',
                        headers : { 'X-Redmine-API-Key': getHash() },
                        data    : {include: 'attachments'},
                        error   : showError,
                        success : function(page) {
                            page = page.wiki_page? page.wiki_page: page.issue;
                            if(page && page.attachments) {
                                var lastAttach    = page.attachments[page.attachments.length-1];
                                var attachTable   = $(".attachments table tbody");

                                if(attachTable.length == 0) {
                                    $("#wiki_add_attachment").before('<div class="attachments"><table><tbody></tbody></table></div>');
                                    attachTable   = $(".attachments table tbody");
                                }

                                var lastRow       = attachTable.find('tr').last();
                                var hrefCount     = 0;
                                var linkTextCount = 0;
                                var lastRowHtml   = $(lastRow).html();

                                if(!lastRowHtml) {
                                    lastRowHtml = '<td>'
                                                + '    <a class="icon icon-attachment" href="/redmine/attachments/00" data-bcup-haslogintext="no">NAME</a>    <span class="size">(SIZE KB)</span>'
                                                + '    <a class="icon-only icon-download" title="Download" href="/redmine/attachments/download/00/NAME" data-bcup-haslogintext="no">NAME</a>  </td>'
                                                + '  <td></td>'
                                                + '  <td>'
                                                + '      <span class="author">USER, TIMESTAMP</span>'
                                                + '  </td>'
                                                + '  <td>'
                                                + '      <a data-confirm="Are you sure ?" class="delete icon-only icon-del" title="Delete" rel="nofollow" data-method="delete" href="/redmine/attachments/00" data-bcup-haslogintext="no">Delete</a>'
                                                + '  </td>';
                                }
                                // replace icon link
                                lastRowHtml = lastRowHtml.replace(/href="[^"]+"/g, function(match) {
                                    var path = lastAttach.content_url.substring(0, lastAttach.content_url.indexOf('/attachments/download/')+'/attachments'.length);

                                    //var path = lastAttach.content_url.substring(0, lastAttach.content_url.lastIndexOf('/'));

                                    //path = path.substring(0, path.lastIndexOf('/'));

                                    switch(hrefCount++) {
                                        case  0:
                                        case  2: return 'href="'+path+'/'+lastAttach.id+'"';
                                        case  1: return 'href="'+lastAttach.content_url+'"';
                                        default: return match;
                                    }
                                });
                                // replace file size
                                lastRowHtml = lastRowHtml.replace(/\((.*?) KB\)/, '('+(lastAttach.filesize/1024).toFixed(2)+' KB)');
                                // replace file name
                                lastRowHtml = lastRowHtml.replace(/>[^<]+<\/a>/g, function(match) {
                                    if(linkTextCount++ < 2) {
                                        return '>'+lastAttach.filename+'</a>';
                                    } else {
                                        return match;
                                    }
                                });
                                // replace author and date
                                var attachDate = new Date(lastAttach.created_on).toLocaleString();
                                lastRowHtml = lastRowHtml.replace(/author">[^<]+/, 'author">'+lastAttach.author.name+', '+
                                    attachDate.replaceAll('/', '-').substring(0, attachDate.lastIndexOf(':'))
                                );
                                // add the new attachment to the attachments list
                                attachTable.append(lastRowHtml);
                                // increment the number of attachments
                                var numAttachs = $("fieldset legend");
                                numAttachs.text(numAttachs.text().replace(/\d+/, function(match) {
                                    return Number(match)+1;
                                }));
                            }
                        }
                    });
                }

                /**
                 * Fix for `{{fnlist}}` duplication with the `redmine_wiki_extensions` plugin.
                 */
                function fixFnListDuplication(value) {
                    return value.replace(/\n\n\{\{fnlist\}\}\n*$/, '');
                }

                /**
                 * Fix for Wiki Extensions header page.
                 */
                function fixWikiExtensionsHeader(value) {
                    return value.replace(/\n<div id="wiki_extentions_header">[\S\s]+?\n<\/div>\n\n/gi, '');
                }

                /**
                 * Fix for Wiki Extensions footer page.
                 */
                function fixWikiExtensionsFooter(value) {
                    return value.replace(/\n\n<div id="wiki_extentions_footer">[\S\s]+?\n<\/div>$/gi, '');
                }

                var data = {
                    attachments: [{
                        token         : token,
                        filename      : resource,
                        'content-type': type
                    }]
                };

                if(page.wiki_page) {
                    // Wiki page
                    data.wiki_page = {
                        text: fixFnListDuplication(fixWikiExtensionsFooter(fixWikiExtensionsHeader(updateDiagramReference(page.wiki_page.text)))),
                        comments: originalName+" -> "+resource
                    };
                    // If it is the main wiki page, the full page name is needed for the put
                    var l = pageUrl.length-'/wiki'.length;

                    if(l >= 0 && pageUrl.lastIndexOf('/wiki') === l) {
                        pageUrl += "/"+page.wiki_page.title;
                    }
                }
                else {
                    // Issue
                    data.issue = {
                        description: fixFnListDuplication(updateDiagramReference(page.issue.description))
                    }

                    // EasyRedmine can update attachments, no need to add a new note
                    if(!Drawio.settings.isEasyRedmine)
                        // Find journal note referencing the image
                        for(var i=page.issue.journals.length-1; i>=0; i--) {
                            if(referencesDiagram(page.issue.journals[i].notes)) {
                                // Add a new issue note
                                data.issue.notes = updateDiagramReference(page.issue.journals[i].notes);
                                data.issue.private_notes = page.issue.journals[i].private_notes;
                                break;
                            }
                        }
                }

                // Update the wiki/issue source page
                $.ajax({
                    url     : pageUrl+'.json',
                    type    : 'PUT',
                    dataType: 'text',
                    headers : { 'X-Redmine-API-Key': getHash() },
                    data    : data,
                    error   : showError,
                    success : updateAttachmentList
                });
            }

            // To attach a file we need to make a PUT request to update the wiki page.
            // But to update the page we must send the text of the page, even if not changed.
            // So first we read the page definition, then we send the update request using
            // the original page text.
            $.ajax({
                url     : pageUrl+'.json',
                type    : 'GET',
                dataType: 'json',
                headers : { 'X-Redmine-API-Key': getHash() },
                data    : {include: 'journals'},
                success : savePage,
                error   : showError
            });
        }

        if(resource) {
            // Upload the attachment
            $.ajax({
                url        : Drawio.settings.redmineUrl+'uploads.json?filename='+resource,
                type       : 'POST',
                contentType: 'application/octet-stream',
                headers    : { 'X-Redmine-API-Key': getHash() },
                processData: false,
                data       : imageData,
                dataType   : 'json',
                success    : readWikiPage,
                error      : showError
            });
        }
    }

};

// From http://blog.danguer.com/2011/10/24/base64-binary-decoding-in-javascript/
var Base64Binary = {
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    /* will return a  Uint8Array type */
    decodeArrayBuffer: function(input) {
        var bytes = (input.length/4) * 3;
        var ab = new ArrayBuffer(bytes);

        this.decode(input, ab);

        return ab;
    },

    removePaddingChars: function(input){
        var lkey = this._keyStr.indexOf(input.charAt(input.length - 1));
        if(lkey == 64){
            return input.substring(0,input.length - 1);
        }
        return input;
    },

    decode: function (input, arrayBuffer) {
        //get last chars to see if are valid
        input = this.removePaddingChars(input);
        input = this.removePaddingChars(input);

        var bytes = parseInt((input.length / 4) * 3, 10);

        var uarray;
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        var j = 0;

        if (arrayBuffer)
            uarray = new Uint8Array(arrayBuffer);
        else
            uarray = new Uint8Array(bytes);

        input = input.replace(/[^A-Za-z0-9+/=]/g, "");

        for (i=0; i<bytes; i+=3) {
            //get the 3 octects in 4 ascii chars
            enc1 = this._keyStr.indexOf(input.charAt(j++));
            enc2 = this._keyStr.indexOf(input.charAt(j++));
            enc3 = this._keyStr.indexOf(input.charAt(j++));
            enc4 = this._keyStr.indexOf(input.charAt(j++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            uarray[i] = chr1;
            if (enc3 != 64) uarray[i+1] = chr2;
            if (enc4 != 64) uarray[i+2] = chr3;
        }

        return uarray;
    },

    encode: function (input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;

        while(i < input.length) {
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if(isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if(isNaN(chr3)) {
                enc4 = 64;
            }

            output = output +
                this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
                this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);

        }

        return output;
    },

    /**
     * Convert an ArrayBuffer to String.
     * @param buffer ArrayBuffer to convert
     * @return String extracted from the ArrayBuffer argument.
     */
    arrayBufferToString: function(buffer) {
        var arr = new Uint8Array(buffer);
        // See https://github.com/inexorabletash/text-encoding
        var str = new TextDecoder('utf-8').decode(arr);

        return str;
    }
};

window.onDrawioViewerLoad = function() {
    // The 'toolbar-buttons' configuration option expects a function in the `handler` option.
    // But in the 'data-mxgraph' attribute the JSON is a string, which is converted to an object,
    // so a literal function name o even an function expression will raise an error.
    // The only solution is to express the handler as an expression in a string, but this requires
    // a small patch in the `addToolbar` function.
    // To not keep a patched version of the `viewer-static.min.js` file, I will patch it runtime.
    // Maybe it will broke in the future, but for now is working.

    // Patch the code `mxEvent.addListener(g,"click",b)`
    var funcName = 'createToolbarButton';

    if(typeof(GraphViewer.prototype[funcName]) === "undefined") {
        funcName = 'addToolbar';
    }

    var code = GraphViewer.prototype[funcName].toString();
    var searchRegex = /mxEvent\.addListener\(([a-zA-Z]+),"click",([a-zA-Z]+)\)/;
    var replaceRules = "mxEvent.addListener($1,\"click\",(typeof($2)==='string'?eval($2):$2))";

    code = code.replace(searchRegex, replaceRules);
    // Apply the patch
    GraphViewer.prototype[funcName] = eval("("+code+")");
    // Draw graphs
    GraphViewer.processElements();
    // Make sure MathJax sees the SVG generated by te viewer
    if(typeof(MathJax) !== 'undefined') {
      if (typeof(MathJax.Hub) !== 'undefined') {
        MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
      } else if(typeof(MathJax.typeset) !== 'undefined') {
        MathJax.typeset();
      }
    }
}

$(function() {
  if(typeof CKEDITOR === 'undefined') return false;

  var basePath = CKEDITOR.basePath;

  basePath = basePath.substr(0, basePath.indexOf("plugin_assets")+"plugin_assets".length);
  basePath = basePath.replace(/https?:\/\/[^\/]+/, "");
  CKEDITOR.plugins.addExternal('drawio', basePath+'/redmine_drawio/javascripts/', 'drawio_plugin.js');

  if(typeof(Object.getOwnPropertyDescriptor(CKEDITOR, 'editorConfig')) === "undefined") {
      // CKEDITOR.editorConfig is not patched: add a patch to intercept changes of the
      // editorConfig property and be able to apply more than one setup.
      var oldEditorConfig = CKEDITOR.editorConfig || null;

      Object.defineProperty(CKEDITOR, 'editorConfig', {
          get: function() { return oldEditorConfig; },
          set: function(newValue) {
                   if(oldEditorConfig) {
                       var prevValue = oldEditorConfig;

                       oldEditorConfig = function(config) {
                            prevValue(config);
                            newValue(config);
                       }
                   }
                   else
                       oldEditorConfig = newValue;
                }
      });
  }

  CKEDITOR.editorConfig = function(config) {
      // Workaround for the configuration override.
      // The Redmine CKEditor plugin has its own config.js that resets
      // any change to the extraPlugins property.
      // This code implements a setter on the config.extraPlugins property
      // so the new value is not replaced but instead appended to the
      // existing value. It is supported by the major modern browser (for
      // example from IE 9).
      if(typeof(Object.getOwnPropertyDescriptor(config, 'extraPlugins')) === "undefined") {
          var _extraPlugins = config.extraPlugins || '';

          Object.defineProperty(config, 'extraPlugins', {
              get: function() { return _extraPlugins; },
              set: function(newValue) {
                    if(_extraPlugins === '')
                        _extraPlugins = newValue;
                    else
                        _extraPlugins += ','+newValue;
                }
          });
      }

      // Same as before, but this time I want the drawio toolbar appended
      // after the default toolbar
      if(typeof(Object.getOwnPropertyDescriptor(config, 'toolbar')) === "undefined") {
          var _toolbar = config.toolbar || [];

          Object.defineProperty(config, 'toolbar', {
              get: function() {
                  return _toolbar.concat(config.extraToolbar);
              },
              set: function(newValue) {
                  _toolbar = newValue;
              }
          });
      }

      // Now we can proceed with the CKEDITOR setup
      var drawio_toolbar = [['btn_drawio_attach', 'btn_drawio_dmsf']];

      config.extraPlugins = 'drawio';
      config.extraToolbar = (config.extraToolbar || []).concat(drawio_toolbar);
  }
});
