import { useState, useCallback, useRef } from "react";
import { BaseBoxShapeUtil, HTMLContainer, TLBaseShape, T } from "tldraw";

export type PreviewShape = TLBaseShape<
  "preview",
  {
    html: string;
    w: number;
    h: number;
  }
>;

export class PreviewShapeUtil extends BaseBoxShapeUtil<PreviewShape> {
  static override type = "preview" as const;

  static override props = {
    html: T.string,
    w: T.number,
    h: T.number,
  };

  getDefaultProps(): PreviewShape["props"] {
    return {
      html: "",
      w: 540,
      h: 440,
    };
  }

  override canEdit = () => true;
  override isAspectRatioLocked = () => false;
  override canResize = () => true;

  component(shape: PreviewShape) {
    const isEditing = this.editor.getEditingShapeId() === shape.id;
    const [isLoaded, setIsLoaded] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const handleLoad = useCallback(() => {
      setIsLoaded(true);
    }, []);

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: "all",
          overflow: "hidden",
        }}
      >
        <div className="preview-shape">
          {shape.props.html ? (
            <>
              <iframe
                ref={iframeRef}
                srcDoc={shape.props.html}
                className="preview-shape__iframe"
                style={{
                  pointerEvents: isEditing ? "all" : "none",
                  opacity: isLoaded ? 1 : 0,
                }}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                onLoad={handleLoad}
              />
              {!isLoaded && (
                <div className="preview-shape__loading">Loading...</div>
              )}
              {!isEditing && (
                <div
                  className="preview-shape__overlay"
                  onDoubleClick={() => this.editor.setEditingShape(shape.id)}
                />
              )}
            </>
          ) : (
            <div className="preview-shape__empty">
              <span>Generating...</span>
            </div>
          )}
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: PreviewShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
