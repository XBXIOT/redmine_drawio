$(function () {
    if(typeof jsToolBar === 'undefined') return false;
  
    var dlg = $("#dlg_redmine_drawio").dialog({
        autoOpen: false,
        width   : "auto",
        height  : "auto",
        modal   : true,
        open    : function(event, ui) {
            var params = dlg.data("params");
          
            if(params)
                for(key in params)
                    $("#drawio_"+key).val(params[key]);
        },
        buttons : {
            "Insert macro": function() { 
                var editor    = dlg.data("editor");
                var macroName = dlg.data("macro");
                var diagName  = $("#drawio__P1").val();
                var diagType  = $("input[name=drawio_diagType]:checked").val();
                var size      = $("#drawio_size").val();
              
                if(diagName != "") {
                    // Add/replace file extension
                    diagName = diagName.replace(/^(.*?)(?:\.\w{3})?$/, "$1."+diagType);
                    
                    var options = [diagName];
                  
                    if(/^\d+$/.test(size))
                        options.push("size="+size);
                  
                    if(options.length)
                        options = '('+options.join(',')+')';
                    else
                        options = "";

                    if(dlg.data("params")) {
                        // Edited macro: replace the old macro (with parameters) with the new text
                        editor.encloseSelection('{{'+macroName+options, '', function(sel){ 
                        return ''; 
                        });
                    }
                    else
                        // New macro
                        editor.encloseSelection('{{'+macroName+options+'\n','\n}}');
                    
                    dlg.dialog("close");
                }
            },
            Cancel: function() {
                dlg.dialog("close");
            }
        }
    });
  
    $("#drawio_diagSize").keypress(function(evt) {
        if(evt.altKey || evt.ctrlKey || evt.metaKey || evt.which === 0)
            return true;
      
        var keyCode = evt.keyCode || evt.charCode;
      
        switch(keyCode) {
            case 8: // backspace
                return true;
            default: return new RegExp($(this).attr("pattern")).test(this.value+evt.key); // Check if the character is allowed
        }
    });
  
    // Compatibility checks
    if(!String.prototype.startsWith) {
        String.prototype.startsWith = function(searchString, position) {
            position = position || 0;
            return this.substr(position, searchString.length) === searchString;
        };
    }
  
    if (!String.prototype.trim) {
        String.prototype.trim = function () {
            return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
        };
    }
  
    /**
     * Find where starts the expectedMacro and returs its parameters.<br/>
     * It expects that the cursor is positioned inside the macro.<br/>
     * The macro header (the opening brackets, the macro name and the
     * optional parameters) will be selected, so inserting the new
     * macro header will overwite the old.
     * @param editor The editor where to find the macro
     * @param expectedMacro The expected macro name
     * @return An hash with the macro arguments, or {@code null} if not found.
     */
    function findMacro(editor, expectedMacro) {
        var text = $(editor.textarea).val();
        var caretPos = $(editor.textarea).prop("selectionStart");
      
        // Move left to find macro start; the test on } is needed for not go too much ahead
        while(caretPos > 1 && !text.startsWith('{{', caretPos) && !text.startsWith('}}', caretPos))
            caretPos--;
          
        if(text.startsWith('{{', caretPos)) {
            // Start of a macro
            var macro = text.substring(caretPos);
            var match = macro.match("^\\{\\{"+expectedMacro+"(?:\\((.*)\\))?");
              
            if(match) {
                // Select macro text
                editor.textarea.focus();
                  
                if(typeof(editor.textarea.selectionStart) != 'undefined') {
                    // Firefox/Chrome
                    editor.textarea.selectionStart = caretPos;
                    editor.textarea.selectionEnd   = caretPos+match[0].length;
                }
                else {
                    // IE
                    var range = document.selection.createRange();
                     
                    range.collapse(true);
                    range.moveStart("character", caretPos);
                    range.moveEnd("character", caretPos+match[0].length);
                    range.select();
                }
                  
                // Extracting macro arguments
                var params = {};
                var args   = [];
                  
                if(match[1]) {
                    var positionalParams = 0;
                    
                    args = match[1].split(',');
                     
                    for(var i=0; i<args.length; i++) {
                        var parts = args[i].split('=');
                        
                        if(parts.length == 2) // Named parameter
                            params[parts[0].trim()] = parts[1].trim();
                        else // Positional parameter
                            params['_P'+(++positionalParams)] = parts[0].trim();
                    }
                }
                
                return params;
            }
            else {
                console.debug("Macro diversa");
            }
        }
        else {
            console.debug("Nessuna macro trovata")
        }
          
        return null;
    }
  
    jsToolBar.prototype.elements.drawio_attach = {
        type : 'button',
        after: 'img',
        title: 'Drawio attached diagram',
        fn   : {
            wiki: function(event) {
                var params = findMacro(this, "drawio_attach");
          
                dlg.data("editor", this)
                   .data("macro", "drawio_attach")
                   .data("params", params)
                   .dialog("open");
            }
        }
    };
  
    if(DMSF)
        jsToolBar.prototype.elements.drawio_dmsf = {
            type : 'button',
            after: 'drawio_attach',
            title: 'Drawio DMSF diagram',
            fn   : {
                wiki : function(event) {
                    var params = findMacro(this, "drawio_dmsf");
            
                    dlg.data("editor", this)
                        .data("macro", "drawio_dmsf")
                        .data("params", params)
                        .dialog("open");
                }
            }
        };
      
    // Add space
    jsToolBar.prototype.elements.space_slide = {
        type: 'space'
    }
    
    // Move back the help at the end
    var help = jsToolBar.prototype.elements.help;
    delete(jsToolBar.prototype.elements.help);
    jsToolBar.prototype.elements.help = help;
    
    wikiToolbar.draw();
});
